/**
 * Query Optimizer Module
 * تحسين استعلامات قاعدة البيانات
 */

// ============ QUERY ANALYSIS ============

/**
 * Analyze query performance
 * @param {string} sql - SQL query
 * @param {Array} params - Query parameters
 * @param {number} executionTime - Execution time in ms
 */
function analyzeQuery(sql, params, executionTime) {
  const analysis = {
    sql: sql.substring(0, 200),
    executionTime,
    isSlowQuery: executionTime > 100, // > 100ms is slow
    suggestions: []
  };

  // Check for common issues
  if (sql.includes('SELECT *')) {
    analysis.suggestions.push('تجنب SELECT * واستخدم الأعمدة المحددة فقط');
  }

  if (!sql.includes('LIMIT') && sql.includes('SELECT')) {
    analysis.suggestions.push('أضف LIMIT لتحديد عدد النتائج');
  }

  if (sql.includes('LIKE') && sql.includes('%')) {
    const likePattern = sql.match(/LIKE\s+'([^']+)'/i);
    if (likePattern && likePattern[1].startsWith('%')) {
      analysis.suggestions.push('تجنب LIKE مع % في البداية - لا يستخدم الفهرس');
    }
  }

  if (!sql.includes('WHERE') && sql.includes('SELECT') && !sql.includes('COUNT')) {
    analysis.suggestions.push('أضف شرط WHERE لتصفية النتائج');
  }

  return analysis;
}

// ============ QUERY BUILDER ============

class QueryBuilder {
  constructor(table) {
    this.table = table;
    this._select = ['*'];
    this._where = [];
    this._orderBy = [];
    this._limit = null;
    this._offset = null;
    this._joins = [];
    this._params = [];
  }

  select(...columns) {
    this._select = columns.length > 0 ? columns : ['*'];
    return this;
  }

  where(column, operator, value) {
    if (value === undefined) {
      value = operator;
      operator = '=';
    }
    this._where.push({ column, operator, value });
    return this;
  }

  whereNull(column) {
    this._where.push({ column, operator: 'IS', value: 'NULL', raw: true });
    return this;
  }

  whereNotNull(column) {
    this._where.push({ column, operator: 'IS NOT', value: 'NULL', raw: true });
    return this;
  }

  whereLike(column, value) {
    this._where.push({ column, operator: 'LIKE', value });
    return this;
  }

  whereIn(column, values) {
    if (values.length === 0) return this;
    const placeholders = values.map(() => '?').join(', ');
    this._where.push({ column, operator: 'IN', value: `(${placeholders})`, values, raw: true });
    return this;
  }

  orderBy(column, direction = 'ASC') {
    const validDirections = ['ASC', 'DESC'];
    const safeDirection = validDirections.includes(direction.toUpperCase()) 
      ? direction.toUpperCase() 
      : 'ASC';
    this._orderBy.push({ column, direction: safeDirection });
    return this;
  }

  limit(count) {
    this._limit = parseInt(count);
    return this;
  }

  offset(count) {
    this._offset = parseInt(count);
    return this;
  }

  join(table, column1, operator, column2) {
    this._joins.push({ type: 'INNER', table, column1, operator, column2 });
    return this;
  }

  leftJoin(table, column1, operator, column2) {
    this._joins.push({ type: 'LEFT', table, column1, operator, column2 });
    return this;
  }

  build() {
    let sql = `SELECT ${this._select.join(', ')} FROM ${this.table}`;
    const params = [];

    // Joins
    for (const join of this._joins) {
      sql += ` ${join.type} JOIN ${join.table} ON ${join.column1} ${join.operator} ${join.column2}`;
    }

    // Where clauses
    if (this._where.length > 0) {
      const conditions = this._where.map(w => {
        if (w.raw) {
          if (w.values) {
            params.push(...w.values);
          }
          return `${w.column} ${w.operator} ${w.value}`;
        }
        params.push(w.value);
        return `${w.column} ${w.operator} ?`;
      });
      sql += ` WHERE ${conditions.join(' AND ')}`;
    }

    // Order by
    if (this._orderBy.length > 0) {
      const orders = this._orderBy.map(o => `${o.column} ${o.direction}`);
      sql += ` ORDER BY ${orders.join(', ')}`;
    }

    // Limit & Offset
    if (this._limit !== null) {
      sql += ` LIMIT ?`;
      params.push(this._limit);
    }

    if (this._offset !== null) {
      sql += ` OFFSET ?`;
      params.push(this._offset);
    }

    return { sql, params };
  }

  // Count query
  buildCount() {
    let sql = `SELECT COUNT(*) as count FROM ${this.table}`;
    const params = [];

    // Joins
    for (const join of this._joins) {
      sql += ` ${join.type} JOIN ${join.table} ON ${join.column1} ${join.operator} ${join.column2}`;
    }

    // Where clauses
    if (this._where.length > 0) {
      const conditions = this._where.map(w => {
        if (w.raw) {
          if (w.values) {
            params.push(...w.values);
          }
          return `${w.column} ${w.operator} ${w.value}`;
        }
        params.push(w.value);
        return `${w.column} ${w.operator} ?`;
      });
      sql += ` WHERE ${conditions.join(' AND ')}`;
    }

    return { sql, params };
  }
}

// ============ BATCH OPERATIONS ============

/**
 * Batch insert with transaction
 * @param {Object} db - Database instance
 * @param {string} table - Table name
 * @param {Array} records - Records to insert
 * @param {number} batchSize - Batch size (default 100)
 */
function batchInsert(db, table, records, batchSize = 100) {
  if (records.length === 0) return { inserted: 0 };

  const columns = Object.keys(records[0]);
  const placeholders = columns.map(() => '?').join(', ');
  const sql = `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${placeholders})`;

  let inserted = 0;
  const stmt = db.prepare(sql);

  const insertBatch = db.transaction((batch) => {
    for (const record of batch) {
      const values = columns.map(col => record[col]);
      stmt.run(...values);
      inserted++;
    }
  });

  // Process in batches
  for (let i = 0; i < records.length; i += batchSize) {
    const batch = records.slice(i, i + batchSize);
    insertBatch(batch);
  }

  return { inserted };
}

/**
 * Batch update with transaction
 * @param {Object} db - Database instance
 * @param {string} table - Table name
 * @param {Array} updates - Array of { id, data } objects
 * @param {string} idColumn - ID column name (default 'id')
 */
function batchUpdate(db, table, updates, idColumn = 'id') {
  if (updates.length === 0) return { updated: 0 };

  let updated = 0;

  const updateBatch = db.transaction((batch) => {
    for (const { id, data } of batch) {
      const columns = Object.keys(data);
      const setClause = columns.map(col => `${col} = ?`).join(', ');
      const values = [...columns.map(col => data[col]), id];
      
      const sql = `UPDATE ${table} SET ${setClause} WHERE ${idColumn} = ?`;
      const stmt = db.prepare(sql);
      const result = stmt.run(...values);
      updated += result.changes;
    }
  });

  updateBatch(updates);
  return { updated };
}

/**
 * Batch delete with transaction
 * @param {Object} db - Database instance
 * @param {string} table - Table name
 * @param {Array} ids - IDs to delete
 * @param {string} idColumn - ID column name (default 'id')
 */
function batchDelete(db, table, ids, idColumn = 'id') {
  if (ids.length === 0) return { deleted: 0 };

  const placeholders = ids.map(() => '?').join(', ');
  const sql = `DELETE FROM ${table} WHERE ${idColumn} IN (${placeholders})`;
  
  const stmt = db.prepare(sql);
  const result = stmt.run(...ids);
  
  return { deleted: result.changes };
}

// ============ PAGINATION HELPERS ============

/**
 * Calculate pagination info
 * @param {number} total - Total records
 * @param {number} page - Current page
 * @param {number} limit - Records per page
 */
function calculatePagination(total, page, limit) {
  const totalPages = Math.ceil(total / limit);
  const offset = (page - 1) * limit;
  const hasNext = page < totalPages;
  const hasPrev = page > 1;

  return {
    page,
    limit,
    total,
    totalPages,
    offset,
    hasNext,
    hasPrev,
    nextPage: hasNext ? page + 1 : null,
    prevPage: hasPrev ? page - 1 : null
  };
}

/**
 * Build cursor-based pagination query
 * @param {Object} options - Pagination options
 */
function buildCursorPagination(options) {
  const { cursor, sortField = 'created_at', sortOrder = 'DESC', limit = 50 } = options;
  
  let whereClause = '';
  const params = [];

  if (cursor) {
    const operator = sortOrder.toUpperCase() === 'DESC' ? '<' : '>';
    whereClause = `AND ${sortField} ${operator} ?`;
    params.push(cursor);
  }

  const orderClause = `ORDER BY ${sortField} ${sortOrder} LIMIT ?`;
  params.push(limit + 1); // Fetch one extra to check if there's more

  return { whereClause, orderClause, params };
}

/**
 * Process cursor pagination results
 * @param {Array} results - Query results
 * @param {number} limit - Requested limit
 * @param {string} sortField - Sort field for cursor
 */
function processCursorResults(results, limit, sortField) {
  const hasMore = results.length > limit;
  const items = hasMore ? results.slice(0, limit) : results;
  const nextCursor = hasMore && items.length > 0 
    ? items[items.length - 1][sortField] 
    : null;

  return { items, hasMore, nextCursor };
}

// ============ INDEX SUGGESTIONS ============

/**
 * Suggest indexes based on query patterns
 * @param {Array} queries - Array of query objects with sql and frequency
 */
function suggestIndexes(queries) {
  const suggestions = [];
  const columnUsage = {};

  for (const { sql, frequency = 1 } of queries) {
    // Extract WHERE columns
    const whereMatch = sql.match(/WHERE\s+(.+?)(?:ORDER|LIMIT|$)/i);
    if (whereMatch) {
      const conditions = whereMatch[1].split(/\s+AND\s+/i);
      for (const condition of conditions) {
        const colMatch = condition.match(/(\w+)\s*[=<>]/);
        if (colMatch) {
          const col = colMatch[1];
          columnUsage[col] = (columnUsage[col] || 0) + frequency;
        }
      }
    }

    // Extract ORDER BY columns
    const orderMatch = sql.match(/ORDER\s+BY\s+(\w+)/i);
    if (orderMatch) {
      const col = orderMatch[1];
      columnUsage[col] = (columnUsage[col] || 0) + frequency * 0.5;
    }
  }

  // Sort by usage and suggest top columns
  const sortedColumns = Object.entries(columnUsage)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);

  for (const [column, usage] of sortedColumns) {
    if (usage > 5) {
      suggestions.push({
        column,
        usage,
        suggestion: `CREATE INDEX IF NOT EXISTS idx_${column} ON table_name(${column})`
      });
    }
  }

  return suggestions;
}

// ============ EXPORTS ============
module.exports = {
  analyzeQuery,
  QueryBuilder,
  batchInsert,
  batchUpdate,
  batchDelete,
  calculatePagination,
  buildCursorPagination,
  processCursorResults,
  suggestIndexes
};
