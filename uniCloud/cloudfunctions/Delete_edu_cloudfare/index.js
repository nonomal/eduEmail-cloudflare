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

    // 删除邮箱路由
    async deleteEmailRoutes(email) {
        console.log('=== 开始删除Cloudflare邮箱路由 ===');
        console.log('目标邮箱:', email);

        try {
            // 首先获取所有邮箱路由规则
            const listResponse = await axios.get(
                `${this.baseURL}/zones/${this.zoneId}/email/routing/rules`,
                {
                    headers: {
                        'Authorization': `Bearer ${this.apiToken}`,
                        'Content-Type': 'application/json'
                    }
                }
            );

            if (!listResponse.data.success) {
                throw new Error(`获取邮箱路由列表失败: ${JSON.stringify(listResponse.data.errors)}`);
            }

            console.log('获取到的路由规则总数:', listResponse.data.result.length);

            // 查找匹配的路由规则
            const matchingRules = listResponse.data.result.filter(rule => {
                return rule.matchers && rule.matchers.some(matcher => 
                    matcher.field === 'to' && matcher.value === email
                );
            });

            console.log('找到匹配的路由规则数:', matchingRules.length);
            console.log('匹配的路由规则:', JSON.stringify(matchingRules, null, 2));

            if (matchingRules.length === 0) {
                console.log('未找到该邮箱的路由规则');
                return {
                    success: true,
                    message: '未找到该邮箱的路由规则',
                    deletedCount: 0
                };
            }

            // 删除所有匹配的路由规则
            const deletePromises = matchingRules.map(async (rule) => {
                console.log(`删除路由规则 ID: ${rule.id}`);
                
                try {
                    const deleteResponse = await axios.delete(
                        `${this.baseURL}/zones/${this.zoneId}/email/routing/rules/${rule.id}`,
                        {
                            headers: {
                                'Authorization': `Bearer ${this.apiToken}`,
                                'Content-Type': 'application/json'
                            }
                        }
                    );

                    if (!deleteResponse.data.success) {
                        console.error(`删除路由规则 ${rule.id} 失败:`, deleteResponse.data.errors);
                        throw new Error(`删除路由规则失败: ${JSON.stringify(deleteResponse.data.errors)}`);
                    }

                    console.log(`✅ 成功删除路由规则 ${rule.id}`);
                    return { success: true, ruleId: rule.id };
                } catch (error) {
                    console.error(`删除路由规则 ${rule.id} 时出错:`, error);
                    return { success: false, ruleId: rule.id, error: error.message };
                }
            });

            const deleteResults = await Promise.all(deletePromises);
            const successCount = deleteResults.filter(result => result.success).length;
            const failedCount = deleteResults.filter(result => !result.success).length;

            console.log(`删除结果: 成功 ${successCount} 个, 失败 ${failedCount} 个`);

            return {
                success: failedCount === 0,
                message: `删除了 ${successCount} 个路由规则${failedCount > 0 ? `, ${failedCount} 个失败` : ''}`,
                deletedCount: successCount,
                failedCount: failedCount,
                details: deleteResults
            };

        } catch (error) {
            console.error('=== 删除Cloudflare邮箱路由失败 ===');
            console.error('错误详情:', error);
            
            if (error.response) {
                console.error('错误响应状态码:', error.response.status);
                console.error('错误响应数据:', JSON.stringify(error.response.data, null, 2));
            }
            
            throw error;
        }
    }
}

exports.main = async (event, context) => {
    console.log('=== Delete_edu_cloudfare 云函数开始执行 ===');
    console.log('接收到的事件参数:', JSON.stringify(event, null, 2));
    
    try {
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
            return CorsUtils.errorResponse('方法不允许', 405, headers);
        }

        // 解析请求体
        let requestData;
        try {
            requestData = CorsUtils.parseBody(body) || event;
        } catch (parseError) {
            console.error('请求体解析失败:', parseError);
            return CorsUtils.errorResponse(parseError, 400, headers);
        }

        const { email } = requestData;
        
        if (!email) {
            console.error('缺少必需的参数: email');
            return CorsUtils.errorResponse('缺少邮箱地址参数', 400, headers);
        }
        
        console.log('准备删除邮箱:', email);

        // 获取数据库引用
        const db = uniCloud.database();
        
        // 删除结果统计
        const deleteResults = {
            cloudflare: { success: false, message: '', deletedCount: 0 },
            emailData: { success: false, message: '', deletedCount: 0 },
            tempEmails: { success: false, message: '', deletedCount: 0 }
        };

        // 1. 删除Cloudflare邮箱路由
        console.log('=== 步骤1: 删除Cloudflare邮箱路由 ===');
        try {
            const cloudflare = new CloudflareAPI();
            const cloudflareResult = await cloudflare.deleteEmailRoutes(email);
            deleteResults.cloudflare = {
                success: cloudflareResult.success,
                message: cloudflareResult.message,
                deletedCount: cloudflareResult.deletedCount || 0
            };
            console.log('Cloudflare删除结果:', deleteResults.cloudflare);
        } catch (cloudflareError) {
            console.error('删除Cloudflare路由失败:', cloudflareError);
            deleteResults.cloudflare = {
                success: false,
                message: `删除Cloudflare路由失败: ${cloudflareError.message}`,
                deletedCount: 0
            };
        }

        // 2. 删除cloudflare_edukg_email集合中的邮件数据
        console.log('=== 步骤2: 删除邮件数据 ===');
        try {
            const emailCollection = db.collection('cloudflare_edukg_email');
            const emailDeleteResult = await emailCollection
                .where({
                    emailTo: email
                })
                .remove();
            
            deleteResults.emailData = {
                success: true,
                message: `删除了 ${emailDeleteResult.deleted} 条邮件记录`,
                deletedCount: emailDeleteResult.deleted
            };
            console.log('邮件数据删除结果:', deleteResults.emailData);
        } catch (emailError) {
            console.error('删除邮件数据失败:', emailError);
            deleteResults.emailData = {
                success: false,
                message: `删除邮件数据失败: ${emailError.message}`,
                deletedCount: 0
            };
        }

        // 3. 删除temp_emails集合中的邮箱记录
        console.log('=== 步骤3: 删除临时邮箱记录 ===');
        try {
            const tempEmailCollection = db.collection('temp_emails');
            const tempEmailDeleteResult = await tempEmailCollection
                .where({
                    email: email
                })
                .remove();
            
            deleteResults.tempEmails = {
                success: true,
                message: `删除了 ${tempEmailDeleteResult.deleted} 条邮箱记录`,
                deletedCount: tempEmailDeleteResult.deleted
            };
            console.log('临时邮箱记录删除结果:', deleteResults.tempEmails);
        } catch (tempEmailError) {
            console.error('删除临时邮箱记录失败:', tempEmailError);
            deleteResults.tempEmails = {
                success: false,
                message: `删除临时邮箱记录失败: ${tempEmailError.message}`,
                deletedCount: 0
            };
        }

        // 汇总删除结果
        const overallSuccess = deleteResults.cloudflare.success || 
                              deleteResults.emailData.success || 
                              deleteResults.tempEmails.success;

        const totalDeleted = deleteResults.cloudflare.deletedCount + 
                           deleteResults.emailData.deletedCount + 
                           deleteResults.tempEmails.deletedCount;

        const responseData = {
            success: overallSuccess,
            message: overallSuccess ? 
                `邮箱删除完成，共删除 ${totalDeleted} 项数据` : 
                '邮箱删除失败',
            email: email,
            details: deleteResults,
            summary: {
                totalDeleted: totalDeleted,
                cloudflareRoutes: deleteResults.cloudflare.deletedCount,
                emailRecords: deleteResults.emailData.deletedCount,
                tempEmailRecords: deleteResults.tempEmails.deletedCount
            }
        };

        console.log('=== 删除操作完成 ===');
        console.log('最终结果:', JSON.stringify(responseData, null, 2));

        return CorsUtils.successResponse(responseData, headers);

    } catch (error) {
        console.error('=== Delete_edu_cloudfare 云函数执行失败 ===');
        console.error('错误详情:', error);
        console.error('错误堆栈:', error.stack);
        
        // 确保headers变量可用
        const headers = event?.headers || {};
        return CorsUtils.errorResponse(error, 500, headers);
    }
};