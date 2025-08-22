// backend/database.js
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

// ==== Diretórios persistentes (Render usa /data) ====
const isRender = !!process.env.RENDER;

// Permite override por env. Exemplos:
//   SQLITE_PATH=/data/meu-banco.db
//   UPLOADS_DIR=/data/uploads
const DATA_DIR = process.env.SQLITE_DIR
  ? process.env.SQLITE_DIR
  : (isRender ? '/data' : path.join(__dirname, 'data'));

const UPLOADS_DIR = process.env.UPLOADS_DIR
  ? process.env.UPLOADS_DIR
  : (isRender ? path.join('/data', 'uploads') : path.join(__dirname, 'uploads'));

// Garante diretórios
try { fs.mkdirSync(DATA_DIR, { recursive: true }); } catch {}
try { fs.mkdirSync(UPLOADS_DIR, { recursive: true }); } catch {}

// Caminho do banco
const dbPath = process.env.SQLITE_PATH || path.join(DATA_DIR, 'pcp.db');

console.log('[DB] Caminho do banco:', dbPath);
console.log('[DB] Pasta de uploads:', UPLOADS_DIR);

// Conectar ao banco
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Erro ao conectar com o banco SQLite:', err.message);
  } else {
    console.log('Conectado ao banco SQLite com sucesso!');
    initializeDatabase().catch(e => {
      console.error('Falha na inicialização do banco:', e);
    });
  }
});

// ==== Helpers de migração
function getTableInfo(table) {
  return new Promise((resolve, reject) => {
    db.all(`PRAGMA table_info(${table})`, [], (err, rows) => {
      if (err) return reject(err);
      resolve(rows || []);
    });
  });
}

async function ensureColumn(table, column, addSql) {
  const info = await getTableInfo(table);
  const has = info.some(c => c.name === column);
  if (!has) {
    await runAsync(addSql);
    console.log(`✅ Coluna ${column} adicionada em ${table}`);
  } else {
    console.log(`ℹ️  Coluna ${column} já existe em ${table}`);
  }
}

function runAsync(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(err){ if (err) reject(err); else resolve(this); });
  });
}

function allAsync(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows)=>{ if (err) reject(err); else resolve(rows); });
  });
}

function getAsync(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row)=>{ if (err) reject(err); else resolve(row); });
  });
}

// ==== Inicialização
async function initializeDatabase() {
  console.log('🔧 Inicializando banco de dados SQLite...');

  // 1) usuarios
  await runAsync(`
    CREATE TABLE IF NOT EXISTS usuarios (
      uid TEXT PRIMARY KEY,
      nome_completo TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password TEXT,
      cargo TEXT DEFAULT 'usuario',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  console.log('✅ Tabela usuarios criada/verificada com sucesso!');

  // 2) tarefas
  await runAsync(`
    CREATE TABLE IF NOT EXISTS tarefas (
      id TEXT PRIMARY KEY,
      titulo TEXT NOT NULL,
      responsavel TEXT NOT NULL,
      responsavel_id TEXT NOT NULL,
      data_vencimento DATE,
      observacoes TEXT,
      status TEXT DEFAULT 'pendente',
      recorrente BOOLEAN DEFAULT FALSE,
      frequencia TEXT DEFAULT 'mensal',
      data_criacao DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (responsavel_id) REFERENCES usuarios (uid)
    )
  `);
  console.log('✅ Tabela tarefas criada/verificada com sucesso!');

  // 3) arquivos
  await runAsync(`
    CREATE TABLE IF NOT EXISTS arquivos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      filename TEXT NOT NULL,
      original_name TEXT NOT NULL,
      file_path TEXT NOT NULL,
      mime_type TEXT NOT NULL,
      size INTEGER NOT NULL,
      task_id TEXT NOT NULL,
      uploaded_by TEXT NOT NULL,
      upload_date DATETIME DEFAULT CURRENT_TIMESTAMP,
      download_count INTEGER DEFAULT 0,
      FOREIGN KEY (task_id) REFERENCES tarefas (id),
      FOREIGN KEY (uploaded_by) REFERENCES usuarios (uid)
    )
  `);
  console.log('✅ Tabela arquivos criada/verificada com sucesso!');

  // 4) atividade_logs
  await runAsync(`
    CREATE TABLE IF NOT EXISTS atividade_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      user_email TEXT NOT NULL,
      action TEXT NOT NULL,
      task_id TEXT,
      task_title TEXT,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES usuarios (uid),
      FOREIGN KEY (task_id) REFERENCES tarefas (id)
    )
  `);
  console.log('✅ Tabela atividade_logs criada/verificada com sucesso!');

  // 5) arquivo_logs
  await runAsync(`
    CREATE TABLE IF NOT EXISTS arquivo_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      arquivo_id INTEGER NOT NULL,
      action TEXT NOT NULL,
      user_id TEXT NOT NULL,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (arquivo_id) REFERENCES arquivos (id),
      FOREIGN KEY (user_id) REFERENCES usuarios (uid)
    )
  `);
  console.log('✅ Tabela arquivo_logs criada/verificada com sucesso!');

  // Migração defensiva: só adiciona coluna se não existir
  await ensureColumn(
    'usuarios',
    'password',
    `ALTER TABLE usuarios ADD COLUMN password TEXT`
  );

  console.log('🎉 Inicialização do banco de dados concluída!');
}

// ==== Funções (mesmas assinaturas que você já usa)
function createTask(taskData) {
  return new Promise((resolve, reject) => {
    const { id, titulo, responsavel, responsavelId, dataVencimento, observacoes, recorrente = false, frequencia = 'mensal' } = taskData;
    if (!id || !titulo || !responsavel || !responsavelId) {
      return reject(new Error(`Dados obrigatórios faltando: ${JSON.stringify({ id, titulo, responsavel, responsavelId })}`));
    }
    if (titulo.length > 255) {
      return reject(new Error(`Título excede 255 caracteres`));
    }
    if (dataVencimento && isNaN(new Date(dataVencimento).getTime())) {
      return reject(new Error(`Data de vencimento inválida: ${dataVencimento}`));
    }
    const sql = `
      INSERT INTO tarefas (id, titulo, responsavel, responsavel_id, data_vencimento, observacoes, recorrente, frequencia)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `;
    db.run(sql, [id, titulo, responsavel, responsavelId, dataVencimento || null, observacoes || null, recorrente, frequencia], function(err) {
      if (err) return reject(err);
      resolve({ id, ...taskData });
    });
  });
}

function checkTaskExists(titulo, dataVencimento, responsavelId) {
  return getAsync(
    `SELECT id FROM tarefas WHERE titulo = ? AND data_vencimento = ? AND responsavel_id = ?`,
    [titulo, dataVencimento, responsavelId]
  ).then(row => !!row);
}

function insertFile(fileData) {
  const { filename, originalName, filePath, mimeType, size, taskId, uploadedBy } = fileData;
  const sql = `
    INSERT INTO arquivos (filename, original_name, file_path, mime_type, size, task_id, uploaded_by)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `;
  return runAsync(sql, [filename, originalName, filePath, mimeType, size, taskId, uploadedBy])
    .then(functionCtx => ({
      id: functionCtx.lastID,
      filename,
      originalName,
      filePath,
      mimeType,
      size,
      taskId,
      uploadedBy,
      uploadDate: new Date().toISOString()
    }));
}

function getFilesByTaskId(taskId) {
  return allAsync(
    `SELECT * FROM arquivos WHERE task_id = ? ORDER BY upload_date DESC`,
    [taskId]
  );
}

function getFileById(fileId) {
  return getAsync(`SELECT * FROM arquivos WHERE id = ?`, [fileId]);
}

function deleteFile(fileId) {
  return runAsync(`DELETE FROM arquivos WHERE id = ?`, [fileId])
    .then(ctx => ({ deletedRows: ctx.changes }));
}

function incrementDownloadCount(fileId) {
  return runAsync(`UPDATE arquivos SET download_count = download_count + 1 WHERE id = ?`, [fileId])
    .then(ctx => ({ updatedRows: ctx.changes }));
}

function logFileActivity(arquivoId, action, userId) {
  return runAsync(
    `INSERT INTO arquivo_logs (arquivo_id, action, user_id) VALUES (?, ?, ?)`,
    [arquivoId, action, userId]
  ).then(ctx => ({ id: ctx.lastID }));
}

function getUserByEmail(email) {
  return getAsync(`SELECT * FROM usuarios WHERE email = ?`, [email]);
}

function getAllUsers() {
  return allAsync(`SELECT * FROM usuarios ORDER BY nome_completo`);
}

function getUserByUid(uid) {
  return getAsync(`SELECT * FROM usuarios WHERE uid = ?`, [uid]);
}

function upsertUser(userData) {
  const { uid, nomeCompleto, email, password, cargo = 'usuario' } = userData;
  const sql = `
    INSERT OR REPLACE INTO usuarios (uid, nome_completo, email, password, cargo, updated_at)
    VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
  `;
  return runAsync(sql, [uid, nomeCompleto, email, password, cargo])
    .then(() => ({ uid, nomeCompleto, email, cargo }));
}

function deleteUser(uid) {
  return runAsync(`DELETE FROM usuarios WHERE uid = ?`, [uid])
    .then(ctx => ({ deletedRows: ctx.changes }));
}

function getTaskById(taskId) {
  return getAsync(`SELECT * FROM tarefas WHERE id = ?`, [taskId]);
}

function getAllTasks() {
  return allAsync(`SELECT * FROM tarefas ORDER BY data_criacao DESC`);
}

function getTasksByUser(userId) {
  return allAsync(`SELECT * FROM tarefas WHERE responsavel_id = ? ORDER BY data_criacao DESC`, [userId]);
}

function updateTaskStatus(taskId, status) {
  return runAsync(`UPDATE tarefas SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`, [status, taskId])
    .then(ctx => ({ taskId, status, updatedRows: ctx.changes }));
}

function updateTask(taskId, taskData) {
  const { titulo, responsavel, responsavelId, dataVencimento, observacoes, recorrente, frequencia } = taskData;
  const sql = `
    UPDATE tarefas SET 
      titulo = ?,
      responsavel = ?,
      responsavel_id = ?,
      data_vencimento = ?,
      observacoes = ?,
      recorrente = ?,
      frequencia = ?,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `;
  return runAsync(sql, [titulo, responsavel, responsavelId, dataVencimento, observacoes, recorrente, frequencia, taskId])
    .then(ctx => ({ taskId, updatedRows: ctx.changes }));
}

function deleteTask(taskId) {
  return runAsync(`DELETE FROM tarefas WHERE id = ?`, [taskId])
    .then(ctx => ({ deletedRows: ctx.changes }));
}

function insertActivityLog(logData) {
  const { userId, userEmail, action, taskId, taskTitle } = logData;
  const sql = `
    INSERT INTO atividade_logs (user_id, user_email, action, task_id, task_title)
    VALUES (?, ?, ?, ?, ?)
  `;
  return runAsync(sql, [userId, userEmail, action, taskId, taskTitle])
    .then(ctx => ({ id: ctx.lastID, userId, userEmail, action, taskId, taskTitle }));
}

function getActivityLogs(userId = null, limit = 100) {
  if (userId) {
    return allAsync(`SELECT * FROM atividade_logs WHERE user_id = ? ORDER BY timestamp DESC LIMIT ?`, [userId, limit]);
  }
  return allAsync(`SELECT * FROM atividade_logs ORDER BY timestamp DESC LIMIT ?`, [limit]);
}

// ==== Exports
module.exports = {
  db,
  // uploads
  uploadsDir: UPLOADS_DIR,
  insertFile,
  getFilesByTaskId,
  getFileById,
  deleteFile,
  incrementDownloadCount,
  logFileActivity,
  // usuários
  upsertUser,
  getUserByUid,
  getUserByEmail,
  getAllUsers,
  deleteUser,
  // tarefas
  createTask,
  getTaskById,
  getAllTasks,
  getTasksByUser,
  updateTaskStatus,
  updateTask,
  deleteTask,
  // logs
  insertActivityLog,
  getActivityLog: getActivityLogs,
  // util
  checkTaskExists
};
