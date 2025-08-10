'use strict';

const axios = require('axios');

// CORS工具函数
class CorsUtils {
  // 获取请求来源
  static getOrigin(headers) {
    return headers?.origin || headers?.Origin || '*';
  }

  // 设置CORS响应头
  static setCorsHeaders(origin, additionalHeaders = {}) {
    return {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With, Accept, Origin',
      'Access-Control-Allow-Credentials': 'true',
      'Access-Control-Max-Age': '86400',
      ...additionalHeaders
    };
  }

  // 处理OPTIONS预检请求
  static handleOptionsRequest(headers) {
    const origin = this.getOrigin(headers);
    return {
      statusCode: 200,
      headers: this.setCorsHeaders(origin),
      body: JSON.stringify({ message: 'OK' })
    };
  }

  // 创建成功响应
  static successResponse(data, headers) {
    const origin = this.getOrigin(headers);
    return {
      statusCode: 200,
      headers: this.setCorsHeaders(origin),
      body: JSON.stringify(data)
    };
  }

  // 创建错误响应
  static errorResponse(error, statusCode = 500, headers) {
    const origin = this.getOrigin(headers);
    return {
      statusCode: statusCode,
      headers: this.setCorsHeaders(origin),
      body: JSON.stringify({
        success: false,
        error: error.message || error
      })
    };
  }

  // 验证HTTP方法
  static validateMethod(httpMethod, allowedMethods = ['POST']) {
    return allowedMethods.includes(httpMethod);
  }

  // 解析请求体
  static parseBody(body) {
    try {
      return typeof body === 'string' ? JSON.parse(body) : body;
    } catch (error) {
      throw new Error('无效的请求体格式');
    }
  }
}

// 配置文件
const config = {
  cloudflare: {
    api_token: "※※※※※※※※※※※※※※※※※※※※※※※※※※※※",
    zone_id: "※※※※※※※※※※※※※※※※※※※※※※※※※※",
    domain: "※※※※※※※※※"
  },
  workers: {
    // Cloudflare Workers 配置
    worker_name: "orange-paper-039a", // 你的Worker名称
    worker_route: "yydsoi.edu.kg", // Worker的路由域名，使用你的主域名
    use_worker_first: true // 只使用 Worker 方式
  }
};

// 生成8位随机邮箱名
function generateRandomEmailName() {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < 8; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// Cloudflare API操作
class CloudflareAPI {
  constructor() {
    this.apiToken = config.cloudflare.api_token;
    this.zoneId = config.cloudflare.zone_id;
    this.domain = config.cloudflare.domain;
    this.baseURL = 'https://api.cloudflare.com/client/v4';
  }

  // 创建邮箱路由
  async createEmailRoute(email) {
    try {
      // 验证配置
      this.validateConfig();

      if (config.workers.use_worker_first) {
        console.log('使用 Worker 方式创建邮箱路由...');
        return await this.createWorkerRoute(email);
      } else {
        console.log('使用转发方式创建邮箱路由...');
        return await this.createForwardRoute(email);
      }
    } catch (error) {
      console.error('创建邮箱路由失败，详细错误:', error);
      throw error;
    }
  }

  // 验证配置
  validateConfig() {
    console.log('=== 配置验证 ===');

    // 检查必要的配置项
    if (!this.apiToken || this.apiToken === '') {
      throw new Error('API Token 未配置');
    }

    if (!this.zoneId || this.zoneId === '') {
      throw new Error('Zone ID 未配置');
    }

    if (!this.domain || this.domain === '') {
      throw new Error('域名未配置');
    }

    if (!config.workers.worker_name || config.workers.worker_name === '') {
      throw new Error('Worker 名称未配置');
    }

    if (!config.workers.worker_route || config.workers.worker_route === '') {
      throw new Error('Worker 路由域名未配置');
    }

    console.log('✅ 基础配置验证通过');
    console.log('API Token 长度:', this.apiToken.length);
    console.log('Zone ID 格式:', this.zoneId);
    console.log('域名:', this.domain);
    console.log('Worker 名称:', config.workers.worker_name);
    console.log('Worker 路由域名:', config.workers.worker_route);
  }

  // 创建转发路由（备选方案）
  async createForwardRoute(email) {
    // 这里需要一个真实的邮箱地址作为转发目标
    // 你需要在 Cloudflare 中验证这个邮箱地址
    const forwardToEmail = "admin@yydsoi.edu.kg"; // 请替换为你的真实邮箱

    const payload = {
      name: `temp-forward-${Date.now()}`,
      enabled: true,
      matchers: [
        {
          type: 'literal',
          field: 'to',
          value: email
        }
      ],
      actions: [
        {
          type: 'forward',
          value: [forwardToEmail]
        }
      ],
      priority: 0
    };

    console.log('=== 转发路由创建详情 ===');
    console.log('目标邮箱:', email);
    console.log('转发到:', forwardToEmail);
    console.log('请求体:', JSON.stringify(payload, null, 2));

    try {
      const response = await axios.post(
        `${this.baseURL}/zones/${this.zoneId}/email/routing/rules`,
        payload,
        {
          headers: {
            'Authorization': `Bearer ${this.apiToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (!response.data.success) {
        throw new Error(`Cloudflare API错误: ${JSON.stringify(response.data.errors)}`);
      }

      console.log('✅ 转发邮箱路由创建成功');
      return response.data.result;
    } catch (error) {
      console.error('转发路由创建失败:', error);
      throw error;
    }
  }

  // 创建 Worker 路由
  async createWorkerRoute(email) {
    const payload = {
      name: `temp-${Date.now()}`,
      enabled: true,
      matchers: [
        {
          type: 'literal',
          field: 'to',
          value: email
        }
      ],
      actions: [
        {
          type: 'worker',
          value: [config.workers.worker_name]
        }
      ],
      priority: 0
    };

    console.log('=== Worker 路由创建详情 ===');
    console.log('目标邮箱:', email);
    console.log('Worker 名称:', config.workers.worker_name);
    console.log('Worker 路由域名:', config.workers.worker_route);
    console.log('Zone ID:', this.zoneId);
    console.log('域名:', this.domain);
    console.log('API 基础URL:', this.baseURL);
    console.log('请求体:', JSON.stringify(payload, null, 2));
    console.log('请求头:', JSON.stringify({
      'Authorization': `Bearer ${this.apiToken.substring(0, 10)}...`,
      'Content-Type': 'application/json'
    }, null, 2));

    try {
      console.log('开始发送请求到 Cloudflare API...');
      const response = await axios.post(
        `${this.baseURL}/zones/${this.zoneId}/email/routing/rules`,
        payload,
        {
          headers: {
            'Authorization': `Bearer ${this.apiToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      console.log('=== Cloudflare API 响应详情 ===');
      console.log('响应状态码:', response.status);
      console.log('响应状态文本:', response.statusText);
      console.log('响应头:', JSON.stringify(response.headers, null, 2));
      console.log('响应数据:', JSON.stringify(response.data, null, 2));

      if (!response.data.success) {
        console.error('Cloudflare API 返回失败状态');
        console.error('错误详情:', JSON.stringify(response.data.errors, null, 2));
        throw new Error(`Cloudflare API错误: ${JSON.stringify(response.data.errors)}`);
      }

      console.log('✅ Worker 邮箱路由创建成功');
      return response.data.result;

    } catch (error) {
      console.error('=== Worker 路由创建失败详情 ===');

      if (error.response) {
        // 服务器响应了错误状态码
        console.error('错误响应状态码:', error.response.status);
        console.error('错误响应状态文本:', error.response.statusText);
        console.error('错误响应头:', JSON.stringify(error.response.headers, null, 2));
        console.error('错误响应数据:', JSON.stringify(error.response.data, null, 2));

        // 特别关注 422 错误
        if (error.response.status === 422) {
          console.error('🔴 422 错误 - 请求格式正确但无法处理');
          console.error('可能的原因:');
          console.error('1. Worker 路由配置错误');
          console.error('2. 域名配置问题');
          console.error('3. API Token 权限不足');
          console.error('4. 邮箱路由规则冲突');
          console.error('5. 请求体格式不符合 API 要求');
        }
      } else if (error.request) {
        // 请求已发送但没有收到响应
        console.error('请求已发送但无响应:', error.request);
      } else {
        // 请求设置时出错
        console.error('请求设置错误:', error.message);
      }

      console.error('完整错误对象:', error);
      console.error('错误类型:', error.constructor.name);
      console.error('错误堆栈:', error.stack);

      throw error;
    }
  }


}

exports.main = async (event, context) => {
  try {
    console.log('=== 云函数开始执行 ===');
    console.log('请求方法:', event.httpMethod);
    console.log('请求头:', JSON.stringify(event.headers, null, 2));

    // 解析HTTP请求
    const { httpMethod, body, headers } = event;

    // 处理OPTIONS预检请求
    if (httpMethod === 'OPTIONS') {
      console.log('处理OPTIONS预检请求');
      return CorsUtils.handleOptionsRequest(headers);
    }

    // 验证HTTP方法
    if (!CorsUtils.validateMethod(httpMethod, ['POST'])) {
      console.log('HTTP方法不允许:', httpMethod);
      return CorsUtils.methodNotAllowedResponse(['POST'], headers);
    }

    console.log('开始生成临时邮箱...');

    // 生成8位随机邮箱名
    const emailName = generateRandomEmailName();
    const tempEmail = `${emailName}@${config.cloudflare.domain}`;
    console.log('生成的临时邮箱:', tempEmail);

    // 在Cloudflare中创建邮箱路由
    console.log('开始创建Cloudflare邮箱路由（使用Worker方式）...');
    const cloudflare = new CloudflareAPI();
    const cloudflareResult = await cloudflare.createEmailRoute(tempEmail);
    console.log('Cloudflare邮箱路由创建成功（使用Worker方式）:', JSON.stringify(cloudflareResult, null, 2));

    // 保存到数据库
    console.log('开始保存到数据库...');
    const db = uniCloud.database();
    try {
      const dbResult = await db.collection('temp_emails').add({
        email: tempEmail,
        createdAt: Date.now(),
        deleted: false
      });
      console.log('数据库保存成功:', JSON.stringify(dbResult, null, 2));
    } catch (dbError) {
      if (dbError.error === -407 || dbError.errorMessage?.includes('not found collection')) {
        console.log('数据库集合不存在，尝试创建集合...');
        try {
          const dbResult = await db.collection('temp_emails').add({
            email: tempEmail,
            createdAt: Date.now(),
            deleted: false
          });
          console.log('数据库集合创建成功:', JSON.stringify(dbResult, null, 2));
        } catch (createError) {
          console.error('创建数据库集合失败:', createError);
          console.log('数据库操作失败，但邮箱路由已创建，继续执行');
        }
      } else {
        throw dbError;
      }
    }

    const responseData = {
      success: true,
      email: tempEmail,
      message: '临时邮箱创建成功',
      note: '邮箱路由已创建，邮件将使用Worker方式处理'
    };

    console.log('准备返回成功响应:', JSON.stringify(responseData, null, 2));
    console.log('=== 云函数执行成功 ===');

    return CorsUtils.successResponse(responseData, headers);
  } catch (error) {
    console.error('=== 云函数执行失败 ===');
    console.error('错误详情:', error);
    console.error('错误堆栈:', error.stack);
    console.error('错误类型:', error.constructor.name);

    // 确保headers变量可用
    const headers = event?.headers || {};
    return CorsUtils.errorResponse(error, 500, headers);
  }
};