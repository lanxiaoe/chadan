# Cloudflare Worker + D1 数据库部署指南（网页版）

## 一、创建 D1 数据库（网页端）

### 步骤 1：登录 Cloudflare 控制台

1. 打开浏览器访问 [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. 使用你的账号登录

### 步骤 2：进入 D1 数据库管理页面

1. 在左侧导航栏中，找到并点击 **Workers & Pages**
2. 在顶部标签页中切换到 **D1**
3. 点击 **Create database** 按钮

### 步骤 3：创建数据库

1. **Database name**: 输入 `express_db`
2. **Region**: 选择离你最近的区域（如 Hong Kong 或 Tokyo）
3. 点击 **Create** 按钮

### 步骤 4：记录数据库信息

创建成功后，你会看到数据库详情页面：
- **Database ID**: 8c99912e-ddae-4173-9ceb-d49e0ae3e8ce
- **Database name**: `express_db`

### 步骤 5：创建数据表

在数据库详情页面：
1. 切换到 **Console** 标签页
2. 在 SQL 输入框中输入以下 SQL 语句：

```sql
CREATE TABLE IF NOT EXISTS express (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  recordDate TEXT NOT NULL,
  phone TEXT NOT NULL,
  expressNo TEXT,
  company TEXT,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

3. 点击 **Run** 按钮执行

---

## 二、创建 Worker（网页端）

### 步骤 1：进入 Workers 管理页面

1. 在左侧导航栏中，点击 **Workers & Pages**
2. 切换到 **Workers** 标签页
3. 点击 **Create Worker** 按钮

### 步骤 2：命名 Worker

1. **Worker name**: 输入 `express-tracking-worker`
2. 点击 **Deploy** 按钮

### 步骤 3：编辑 Worker 代码

1. 在 Worker 编辑器页面，删除默认代码
2. 粘贴以下代码：

```javascript
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;

    if (path === '/search') {
      return handleSearch(request, env);
    } else if (path === '/add') {
      return handleAdd(request, env);
    } else if (path === '/batch') {
      return handleBatch(request, env);
    } else if (path === '/verifyPwd') {
      return handleVerifyPwd(request, env);
    }

    return new Response('Not found', { status: 404 });
  }
};

async function handleSearch(request, env) {
  const url = new URL(request.url);
  const phone = url.searchParams.get('phone');
  
  if (!phone) {
    return new Response(JSON.stringify({ empty: true }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    const result = await env.DB.prepare(
      'SELECT recordDate, company, expressNo FROM express WHERE phone = ?'
    ).bind(phone).first();

    if (result) {
      return new Response(JSON.stringify({
        recordDate: result.recordDate,
        company: result.company,
        expressNo: result.expressNo,
        empty: false
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
    } else {
      return new Response(JSON.stringify({ empty: true }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }
  } catch (error) {
    console.error('Search error:', error);
    return new Response(JSON.stringify({ empty: true }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

async function handleAdd(request, env) {
  try {
    const body = await request.json();
    const { recordDate, phone, expressNo, company, adminPwd } = body;

    if (!verifyPassword(adminPwd, env.ADMIN_PASSWORD)) {
      return new Response(JSON.stringify({ ok: false, message: '权限不足' }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    await env.DB.prepare(
      'INSERT INTO express (recordDate, phone, expressNo, company) VALUES (?, ?, ?, ?)'
    ).bind(recordDate, phone, expressNo, company).run();

    return new Response(JSON.stringify({ ok: true, message: '数据保存成功' }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Add error:', error);
    return new Response(JSON.stringify({ ok: false, message: '保存失败' }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

async function handleBatch(request, env) {
  try {
    const body = await request.json();
    const { data, adminPwd } = body;

    if (!verifyPassword(adminPwd, env.ADMIN_PASSWORD)) {
      return new Response(JSON.stringify({ ok: false, message: '权限不足' }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    for (const item of data) {
      await env.DB.prepare(
        'INSERT INTO express (recordDate, phone, expressNo, company) VALUES (?, ?, ?, ?)'
      ).bind(item.recordDate, item.phone, item.expressNo, item.company).run();
    }

    return new Response(JSON.stringify({ ok: true, message: `成功导入${data.length}条` }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Batch error:', error);
    return new Response(JSON.stringify({ ok: false, message: '批量导入失败' }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

async function handleVerifyPwd(request, env) {
  try {
    const body = await request.json();
    const { password } = body;

    if (verifyPassword(password, env.ADMIN_PASSWORD)) {
      return new Response(JSON.stringify({ success: true }), {
        headers: { 'Content-Type': 'application/json' }
      });
    } else {
      return new Response(JSON.stringify({ success: false }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }
  } catch (error) {
    console.error('Verify error:', error);
    return new Response(JSON.stringify({ success: false }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

function verifyPassword(input, correct) {
  return input && correct && input === correct;
}
```

3. 点击 **Save and deploy** 按钮

---

## 三、配置 Worker 绑定（网页端）

### 步骤 1：进入 Worker 设置

1. 在 Workers 列表中，点击你创建的 Worker `express-tracking-worker`
2. 切换到 **Settings** 标签页

### 步骤 2：添加 D1 数据库绑定

1. 找到 **D1 Database Bindings** 部分
2. 点击 **Add binding** 按钮
3. **Variable name**: 输入 `DB`（必须是这个名称，代码中会用到）
4. **Database**: 选择你创建的 `express_db`
5. 点击 **Save** 按钮

### 步骤 3：添加环境变量（管理员密码）

1. 找到 **Environment Variables** 部分
2. 点击 **Add variable** 按钮
3. **Variable name**: 输入 `ADMIN_PASSWORD`
4. **Value**: 输入你设置的管理员密码（如 `your_strong_password_here`）
5. 点击 **Save** 按钮

### 步骤 4：重新部署

1. 点击页面顶部的 **Deploy** 按钮
2. 等待部署完成

---

## 四、获取 Worker URL

部署成功后，在 Worker 详情页面的顶部可以看到：
- **Worker URL**: `https://express-tracking-worker.<你的账户名>.workers.dev`
- 复制这个 URL

---

## 五、更新前端页面

编辑 `index.html` 文件，修改 `API_BASE` 变量：

```javascript
const API_BASE = "https://express-tracking-worker.<你的账户名>.workers.dev";
```

替换为你实际的 Worker URL。

---

## API 接口说明

### GET /search?phone=xxx

查询快递信息

**请求参数：**
- `phone`: 手机号码（字符串）

**响应示例：**
```json
{
  "recordDate": "2024-01-15",
  "company": "顺丰",
  "expressNo": "SF12345678",
  "empty": false
}
```

### POST /add

添加单条快递记录

**请求体：**
```json
{
  "recordDate": "2024-01-15",
  "phone": "13800138000",
  "expressNo": "SF12345678",
  "company": "顺丰",
  "adminPwd": "你的管理员密码"
}
```

### POST /batch

批量添加快递记录

**请求体：**
```json
{
  "data": [
    {
      "recordDate": "2024-01-15",
      "phone": "13800138000",
      "expressNo": "SF12345678",
      "company": "顺丰"
    }
  ],
  "adminPwd": "你的管理员密码"
}
```

### POST /verifyPwd

验证管理员密码

**请求体：**
```json
{
  "password": "你的管理员密码"
}
```

---

## 测试步骤

1. 双击页面标题 3 次，显示管理员登录面板
2. 输入你设置的管理员密码，点击验证身份
3. 验证成功后，管理员区域会显示出来
4. 填写快递信息并保存，数据会存入 D1 数据库
5. 使用手机号码查询，可以看到刚保存的快递信息

---

## 安全注意事项

1. ✅ 管理员密码应设置为强密码（建议 12 位以上，包含大小写字母和数字）
2. ✅ Worker 默认使用 HTTPS 协议，数据传输安全
3. ✅ 建议定期更换管理员密码
4. ⚠️ 可以考虑添加 CORS 限制，只允许你的域名访问
