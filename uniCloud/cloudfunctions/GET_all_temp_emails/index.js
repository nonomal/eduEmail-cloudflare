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
}

// Cloudflare 配置
const config = {
    cloudflare: {
            api_token: "※※※※※※※※※※※※※※※※※※※※※※※※※※※※",
    zone_id: "※※※※※※※※※※※※※※※※※※※※※※※※※※",
    domain: "※※※※※※※※※"
    }
};

// Cloudflare API操作类
class CloudflareAPI {
    constructor() {
        this.apiToken = config.cloudflare.api_token;
        this.zoneId = config.cloudflare.zone_id;
        this.domain = config.cloudflare.domain;
        this.baseURL = 'https://api.cloudflare.com/client/v4';
    }

    // 获取所有邮箱路由规则
    async getAllEmailRoutes() {
        console.log('🔍 正在获取Cloudflare邮箱路由规则...');

        try {
            const response = await axios.get(
                `${this.baseURL}/zones/${this.zoneId}/email/routing/rules`,
                {
                    headers: {
                        'Authorization': `Bearer ${this.apiToken}`,
                        'Content-Type': 'application/json'
                    }
                }
            );

            if (!response.data.success) {
                throw new Error(`获取路由规则失败: ${JSON.stringify(response.data.errors)}`);
            }

            const rules = response.data.result;
            console.log(`📋 找到 ${rules.length} 个邮箱路由规则`);

            return rules;
        } catch (error) {
            console.error('❌ 获取邮箱路由规则失败:', error.message);
            throw error;
        }
    }

    // 过滤临时邮箱规则
    filterTempEmailRoutes(rules) {
        console.log('🔍 正在筛选临时邮箱规则...');

        const tempRules = rules.filter(rule => {
            // 检查规则名称是否以 "temp-" 开头
            const isTempByName = rule.name && rule.name.startsWith('temp-');

            // 检查是否匹配我们的域名
            const isDomainMatch = rule.matchers && rule.matchers.some(matcher =>
                matcher.field === 'to' &&
                matcher.value &&
                matcher.value.includes(this.domain)
            );

            // 检查是否是 Worker 类型的路由
            const isWorkerRoute = rule.actions && rule.actions.some(action =>
                action.type === 'worker'
            );

            return isTempByName || (isDomainMatch && isWorkerRoute);
        });

        console.log(`📝 筛选出 ${tempRules.length} 个临时邮箱规则`);

        // 显示详细信息
        tempRules.forEach((rule, index) => {
            const email = rule.matchers?.[0]?.value || '未知邮箱';
            const workerName = rule.actions?.[0]?.value?.[0] || '未知Worker';
            console.log(`   ${index + 1}. ${rule.name} - ${email} -> ${workerName}`);
        });

        return tempRules;
    }
}

exports.main = async (event, context) => {
    console.log('=== GET_all_temp_emails 云函数开始执行 ===');
    console.log('接收到的事件参数:', JSON.stringify(event, null, 2));

    try {
        // 解析HTTP请求
        const { httpMethod, headers } = event;

        // 处理OPTIONS预检请求
        if (httpMethod === 'OPTIONS') {
            console.log('处理OPTIONS预检请求');
            return CorsUtils.handleOptionsRequest(headers);
        }

        // 验证HTTP方法
        if (httpMethod !== 'POST' && httpMethod !== 'GET') {
            console.log('HTTP方法不允许:', httpMethod);
            return CorsUtils.errorResponse('方法不允许', 405, headers);
        }

        console.log('开始从Cloudflare获取所有临时邮箱...');

        // 创建Cloudflare API实例
        const cloudflareAPI = new CloudflareAPI();

        // 获取所有邮箱路由规则
        const allRoutes = await cloudflareAPI.getAllEmailRoutes();

        // 筛选临时邮箱规则
        const tempRoutes = cloudflareAPI.filterTempEmailRoutes(allRoutes);

        // 转换为邮箱列表格式
        const emailsWithStats = [];
        const db = uniCloud.database();

        for (const rule of tempRoutes) {
            const email = rule.matchers?.[0]?.value || '未知邮箱';

            try {
                // 查询该邮箱的邮件数量
                const emailCountResult = await db.collection('cloudflare_edukg_email')
                    .where({
                        emailTo: email
                    })
                    .count();

                emailsWithStats.push({
                    id: rule.id,
                    email: email,
                    ruleName: rule.name,
                    createdAt: rule.created_on,
                    emailCount: emailCountResult.total,
                    workerName: rule.actions?.[0]?.value?.[0] || '未知Worker',
                    enabled: rule.enabled
                });

                console.log(`邮箱 ${email} 有 ${emailCountResult.total} 封邮件`);
            } catch (error) {
                console.error(`查询邮箱 ${email} 的邮件数量失败:`, error);
                // 即使查询邮件数量失败，也要包含这个邮箱
                emailsWithStats.push({
                    id: rule.id,
                    email: email,
                    ruleName: rule.name,
                    createdAt: rule.created_on,
                    emailCount: 0,
                    workerName: rule.actions?.[0]?.value?.[0] || '未知Worker',
                    enabled: rule.enabled,
                    error: '查询邮件数量失败'
                });
            }
        }

        // 计算总统计信息
        const totalEmails = emailsWithStats.length;
        const totalEmailMessages = emailsWithStats.reduce((sum, item) => sum + item.emailCount, 0);
        const activeEmails = emailsWithStats.filter(item => item.enabled).length;

        const responseData = {
            success: true,
            message: '成功从Cloudflare获取所有临时邮箱',
            data: {
                emails: emailsWithStats,
                statistics: {
                    totalEmails: totalEmails,
                    activeEmails: activeEmails,
                    disabledEmails: totalEmails - activeEmails,
                    totalEmailMessages: totalEmailMessages
                }
            }
        };

        console.log('=== 查询完成 ===');
        console.log('总邮箱数:', totalEmails);
        console.log('活跃邮箱数:', activeEmails);
        console.log('总邮件数:', totalEmailMessages);

        return CorsUtils.successResponse(responseData, headers);

    } catch (error) {
        console.error('=== GET_all_temp_emails 云函数执行失败 ===');
        console.error('错误详情:', error);
        console.error('错误堆栈:', error.stack);

        // 确保headers变量可用
        const headers = event?.headers || {};
        return CorsUtils.errorResponse(error, 500, headers);
    }
};