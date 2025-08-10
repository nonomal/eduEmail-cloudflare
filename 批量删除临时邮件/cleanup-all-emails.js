#!/usr/bin/env node

/**
 * Cloudflare 临时邮箱清理脚本
 * 用于删除所有临时邮箱路由规则
 */

const axios = require('axios');

// Cloudflare 配置
const config = {
    api_token: "※※※※※※※※※※※※※※※※※※※※※※※※※※※※",
    zone_id: "※※※※※※※※※※※※※※※※※※※※※※※※※※",
    domain: "※※※※※※※※※"
};

class CloudflareEmailCleaner {
    constructor() {
        this.apiToken = config.api_token;
        this.zoneId = config.zone_id;
        this.domain = config.domain;
        this.baseURL = 'https://api.cloudflare.com/client/v4';
    }

    // 延迟函数，避免API频率限制
    async delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // 获取所有邮箱路由规则
    async getAllEmailRoutes() {
        console.log('🔍 正在获取所有邮箱路由规则...');
        
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

    // 删除单个路由规则
    async deleteRoute(rule) {
        const email = rule.matchers?.[0]?.value || '未知邮箱';
        
        try {
            console.log(`🗑️  正在删除: ${rule.name} (${email})`);
            
            const response = await axios.delete(
                `${this.baseURL}/zones/${this.zoneId}/email/routing/rules/${rule.id}`,
                {
                    headers: {
                        'Authorization': `Bearer ${this.apiToken}`,
                        'Content-Type': 'application/json'
                    }
                }
            );

            if (!response.data.success) {
                throw new Error(`删除失败: ${JSON.stringify(response.data.errors)}`);
            }

            console.log(`✅ 成功删除: ${rule.name} (${email})`);
            return { success: true, rule: rule };
            
        } catch (error) {
            console.error(`❌ 删除失败: ${rule.name} (${email}) - ${error.message}`);
            return { success: false, rule: rule, error: error.message };
        }
    }

    // 批量删除所有临时邮箱路由
    async deleteAllTempRoutes(dryRun = false) {
        console.log('🚀 开始清理所有临时邮箱路由...');
        console.log(`📍 域名: ${this.domain}`);
        console.log(`📍 Zone ID: ${this.zoneId}`);
        
        if (dryRun) {
            console.log('🔍 这是预览模式，不会实际删除任何内容');
        }
        
        try {
            // 1. 获取所有路由规则
            const allRoutes = await this.getAllEmailRoutes();
            
            if (allRoutes.length === 0) {
                console.log('✨ 没有找到任何邮箱路由规则');
                return { total: 0, deleted: 0, failed: 0 };
            }

            // 2. 筛选临时邮箱规则
            const tempRoutes = this.filterTempEmailRoutes(allRoutes);
            
            if (tempRoutes.length === 0) {
                console.log('✨ 没有找到任何临时邮箱规则');
                return { total: 0, deleted: 0, failed: 0 };
            }

            if (dryRun) {
                console.log(`\n📋 预览模式完成，找到 ${tempRoutes.length} 个临时邮箱规则`);
                console.log('💡 运行 node cleanup-all-emails.js --delete 来实际删除');
                return { total: tempRoutes.length, deleted: 0, failed: 0 };
            }

            // 3. 确认删除
            console.log(`\n⚠️  即将删除 ${tempRoutes.length} 个临时邮箱规则`);
            console.log('⚠️  此操作不可撤销！');
            
            // 在Node.js环境中，我们跳过交互式确认
            console.log('🔄 开始批量删除...');

            // 4. 批量删除
            const results = [];
            let successCount = 0;
            let failCount = 0;

            for (let i = 0; i < tempRoutes.length; i++) {
                const rule = tempRoutes[i];
                
                // 添加延迟避免API频率限制
                if (i > 0) {
                    console.log('⏳ 等待2秒避免API频率限制...');
                    await this.delay(2000);
                }
                
                const result = await this.deleteRoute(rule);
                results.push(result);
                
                if (result.success) {
                    successCount++;
                } else {
                    failCount++;
                }
                
                // 显示进度
                console.log(`📊 进度: ${i + 1}/${tempRoutes.length} (成功: ${successCount}, 失败: ${failCount})`);
            }

            // 5. 显示最终结果
            console.log('\n🎉 清理完成！');
            console.log(`📊 总计: ${tempRoutes.length} 个规则`);
            console.log(`✅ 成功删除: ${successCount} 个`);
            console.log(`❌ 删除失败: ${failCount} 个`);

            if (failCount > 0) {
                console.log('\n❌ 失败的规则:');
                results.filter(r => !r.success).forEach((result, index) => {
                    const email = result.rule.matchers?.[0]?.value || '未知邮箱';
                    console.log(`   ${index + 1}. ${result.rule.name} (${email}) - ${result.error}`);
                });
            }

            return {
                total: tempRoutes.length,
                deleted: successCount,
                failed: failCount,
                results: results
            };

        } catch (error) {
            console.error('💥 清理过程中发生错误:', error.message);
            throw error;
        }
    }

    // 显示统计信息
    async showStats() {
        console.log('📊 正在获取邮箱路由统计信息...');
        
        try {
            const allRoutes = await this.getAllEmailRoutes();
            const tempRoutes = this.filterTempEmailRoutes(allRoutes);
            
            console.log('\n📈 统计信息:');
            console.log(`📋 总路由规则数: ${allRoutes.length}`);
            console.log(`🏷️  临时邮箱规则数: ${tempRoutes.length}`);
            console.log(`🌐 域名: ${this.domain}`);
            
            if (tempRoutes.length > 0) {
                console.log('\n📝 临时邮箱详情:');
                tempRoutes.forEach((rule, index) => {
                    const email = rule.matchers?.[0]?.value || '未知邮箱';
                    const createdDate = new Date(rule.created_on || Date.now()).toLocaleString();
                    console.log(`   ${index + 1}. ${email} (创建于: ${createdDate})`);
                });
            }
            
        } catch (error) {
            console.error('❌ 获取统计信息失败:', error.message);
        }
    }
}

// 主函数
async function main() {
    const args = process.argv.slice(2);
    const cleaner = new CloudflareEmailCleaner();
    
    console.log('🧹 Cloudflare 临时邮箱清理工具');
    console.log('=====================================\n');
    
    try {
        if (args.includes('--help') || args.includes('-h')) {
            console.log('使用方法:');
            console.log('  node cleanup-all-emails.js              # 预览模式，显示将要删除的规则');
            console.log('  node cleanup-all-emails.js --delete     # 实际删除所有临时邮箱规则');
            console.log('  node cleanup-all-emails.js --stats      # 显示统计信息');
            console.log('  node cleanup-all-emails.js --help       # 显示帮助信息');
            return;
        }
        
        if (args.includes('--stats')) {
            await cleaner.showStats();
            return;
        }
        
        const shouldDelete = args.includes('--delete');
        const result = await cleaner.deleteAllTempRoutes(!shouldDelete);
        
        if (!shouldDelete) {
            console.log('\n💡 这只是预览，没有实际删除任何内容');
            console.log('💡 运行 node cleanup-all-emails.js --delete 来实际删除');
        }
        
    } catch (error) {
        console.error('\n💥 脚本执行失败:', error.message);
        process.exit(1);
    }
}

// 如果直接运行此脚本
if (require.main === module) {
    main();
}

module.exports = CloudflareEmailCleaner;