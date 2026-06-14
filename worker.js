export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;

    // 处理 CORS 预检请求
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: corsHeaders()
      });
    }

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

// CORS 头配置
function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json'
  };
}

// 添加 CORS 头到响应
function withCors(response) {
  const newHeaders = new Headers(response.headers);
  newHeaders.set('Access-Control-Allow-Origin', '*');
  newHeaders.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  newHeaders.set('Access-Control-Allow-Headers', 'Content-Type');
  return new Response(response.body, {
    status: response.status,
    headers: newHeaders
  });
}

async function handleSearch(request, env) {
  const url = new URL(request.url);
  const phone = url.searchParams.get('phone');
  
  if (!phone) {
    return withCors(new Response(JSON.stringify({ empty: true }), {
      headers: corsHeaders()
    }));
  }

  try {
    const result = await env.DB.prepare(
      'SELECT recordDate, company, expressNo FROM express WHERE phone = ?'
    ).bind(phone).first();

    if (result) {
      return withCors(new Response(JSON.stringify({
        recordDate: result.recordDate,
        company: result.company,
        expressNo: result.expressNo,
        empty: false
      }), {
        headers: corsHeaders()
      }));
    } else {
      return withCors(new Response(JSON.stringify({ empty: true }), {
        headers: corsHeaders()
      }));
    }
  } catch (error) {
    console.error('Search error:', error);
    return withCors(new Response(JSON.stringify({ empty: true }), {
      headers: corsHeaders()
    }));
  }
}

async function handleAdd(request, env) {
  try {
    const body = await request.json();
    const { recordDate, phone, expressNo, company, adminPwd } = body;

    if (!verifyPassword(adminPwd, env.ADMIN_PASSWORD)) {
      return withCors(new Response(JSON.stringify({ ok: false, message: '权限不足' }), {
        headers: corsHeaders()
      }));
    }

    await env.DB.prepare(
      'INSERT INTO express (recordDate, phone, expressNo, company) VALUES (?, ?, ?, ?)'
    ).bind(recordDate, phone, expressNo, company).run();

    return withCors(new Response(JSON.stringify({ ok: true, message: '数据保存成功' }), {
      headers: corsHeaders()
    }));
  } catch (error) {
    console.error('Add error:', error);
    return withCors(new Response(JSON.stringify({ ok: false, message: '保存失败' }), {
      headers: corsHeaders()
    }));
  }
}

async function handleBatch(request, env) {
  try {
    const body = await request.json();
    const { data, adminPwd } = body;

    // 检查数据库绑定
    if (!env.DB) {
      return withCors(new Response(JSON.stringify({ ok: false, message: '数据库未绑定，请检查 Worker 设置中的 D1 绑定' }), {
        headers: corsHeaders()
      }));
    }

    if (!verifyPassword(adminPwd, env.ADMIN_PASSWORD)) {
      return withCors(new Response(JSON.stringify({ ok: false, message: '权限不足，请检查 ADMIN_PASSWORD 环境变量' }), {
        headers: corsHeaders()
      }));
    }

    for (const item of data) {
      await env.DB.prepare(
        'INSERT INTO express (recordDate, phone, expressNo, company) VALUES (?, ?, ?, ?)'
      ).bind(item.recordDate, item.phone, item.expressNo, item.company).run();
    }

    return withCors(new Response(JSON.stringify({ ok: true, message: `成功导入${data.length}条` }), {
      headers: corsHeaders()
    }));
  } catch (error) {
    console.error('Batch error:', error);
    return withCors(new Response(JSON.stringify({ ok: false, message: `批量导入失败: ${error.message}` }), {
      headers: corsHeaders()
    }));
  }
}

async function handleVerifyPwd(request, env) {
  try {
    const body = await request.json();
    const { password } = body;

    if (verifyPassword(password, env.ADMIN_PASSWORD)) {
      return withCors(new Response(JSON.stringify({ success: true }), {
        headers: corsHeaders()
      }));
    } else {
      return withCors(new Response(JSON.stringify({ success: false }), {
        headers: corsHeaders()
      }));
    }
  } catch (error) {
    console.error('Verify error:', error);
    return withCors(new Response(JSON.stringify({ success: false }), {
      headers: corsHeaders()
    }));
  }
}

function verifyPassword(input, correct) {
  return input && correct && input === correct;
}