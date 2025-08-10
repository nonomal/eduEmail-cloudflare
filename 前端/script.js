// 全局变量存储当前生成的邮箱
let currentEmail = null;

async function generateEmail() {
    const btn = document.getElementById('generateBtn');
    const btnText = document.getElementById('btnText');
    const emailDisplay = document.getElementById('emailDisplay');
    const emailContent = document.getElementById('emailContent');
    const status = document.getElementById('status');

    console.log('=== 前端开始生成邮箱 ===');
    console.log('当前邮箱:', currentEmail);

    // 禁用按钮并显示加载状态
    btn.disabled = true;
    btnText.innerHTML = '<span class="loading"></span>生成中...';

    // 清除之前的所有显示内容
    try {
        status.style.display = 'none';
        emailDisplay.classList.remove('show');

        // 安全地处理emailContent元素
        if (emailContent) {
            emailContent.classList.remove('show');
        } else {
            console.warn('emailContent元素未找到');
        }

        // 清除邮箱地址显示
        const emailAddressElement = document.getElementById('emailAddress');
        if (emailAddressElement) {
            emailAddressElement.textContent = '';
        }

        // 清除本地存储的旧邮箱（强制生成新邮箱）
        currentEmail = null;
        localStorage.removeItem('tempEmail');
        localStorage.removeItem('tempEmailCreatedAt');

        console.log('已清除旧邮箱数据，准备生成新邮箱');
    } catch (clearError) {
        console.error('清除旧数据时出错:', clearError);
        // 继续执行，不要因为清除错误而中断生成流程
    }

    try {
        console.log('准备发送请求到云函数...');
        const requestBody = {};
        console.log('请求体:', JSON.stringify(requestBody, null, 2));

        const response = await fetch('云函数链接generate-email', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(requestBody)
        });

        console.log('收到响应:', response);
        console.log('响应状态:', response.status);
        console.log('响应状态文本:', response.statusText);
        console.log('响应头:', Object.fromEntries(response.headers.entries()));

        const responseText = await response.text();
        console.log('响应文本:', responseText);

        let data;
        try {
            data = JSON.parse(responseText);
            console.log('解析后的响应数据:', JSON.stringify(data, null, 2));

            // 检查是否存在嵌套的JSON字符串
            if (data.body && typeof data.body === 'string') {
                console.log('检测到嵌套JSON字符串，进行二次解析...');
                try {
                    const innerData = JSON.parse(data.body);
                    console.log('二次解析后的数据:', JSON.stringify(innerData, null, 2));
                    data = innerData; // 使用解析后的内部数据
                } catch (innerParseError) {
                    console.error('嵌套JSON解析失败:', innerParseError);
                    throw new Error('嵌套响应数据格式错误');
                }
            }
        } catch (parseError) {
            console.error('JSON解析失败:', parseError);
            throw new Error(`响应格式错误: ${responseText}`);
        }

        if (data.success) {
            console.log('云函数返回成功状态');

            // 保存邮箱到全局变量和本地存储
            currentEmail = data.email;
            localStorage.setItem('tempEmail', data.email);
            localStorage.setItem('tempEmailCreatedAt', Date.now().toString());

            console.log('邮箱已保存到全局变量:', currentEmail);
            console.log('邮箱已保存到本地存储');

            // 显示生成的邮箱
            document.getElementById('emailAddress').textContent = data.email;
            emailDisplay.classList.add('show');

            // 更新邮箱状态信息
            updateEmailInfo(data.email, Date.now());

            // 显示成功状态
            const message = data.note ? `${data.message} - ${data.note}` : data.message;
            console.log('显示成功消息:', message);
            showStatus(message, 'success');

            // 触发邮箱生成成功事件，供其他逻辑使用
            window.dispatchEvent(new CustomEvent('emailGenerated', {
                detail: {
                    email: data.email,
                    timestamp: Date.now(),
                    success: true
                }
            }));

        } else {
            console.error('云函数返回失败状态:', data);
            throw new Error(data.error || '生成失败');
        }
    } catch (error) {
        console.error('=== 前端执行失败 ===');
        console.error('错误详情:', error);
        console.error('错误类型:', error.constructor.name);
        console.error('错误消息:', error.message);

        let errorMessage = '生成失败';
        if (error.message) {
            errorMessage += `: ${error.message}`;
        }
        if (error.name === 'TypeError' && error.message.includes('fetch')) {
            errorMessage = '网络连接失败，请检查网络或稍后重试';
        }
        console.log('显示错误消息:', errorMessage);
        showStatus(errorMessage, 'error');

        // 触发邮箱生成失败事件
        window.dispatchEvent(new CustomEvent('emailGenerated', {
            detail: {
                email: null,
                timestamp: Date.now(),
                success: false,
                error: error.message
            }
        }));
    } finally {
        // 恢复按钮状态
        btn.disabled = false;
        btnText.textContent = '生成新的临时邮箱';
        console.log('=== 前端执行完成 ===');
    }
}

// 获取当前邮箱的函数
function getCurrentEmail() {
    return currentEmail || localStorage.getItem('tempEmail');
}

// 检查是否有有效的邮箱
function hasValidEmail() {
    const email = getCurrentEmail();
    if (!email) return false;

    // 检查邮箱是否在24小时内创建
    const createdAt = localStorage.getItem('tempEmailCreatedAt');
    if (createdAt) {
        const age = Date.now() - parseInt(createdAt);
        const oneDay = 24 * 60 * 60 * 1000;
        return age < oneDay;
    }
    return true;
}

// 清除当前邮箱
async function clearCurrentEmail() {
    const currentEmailAddress = getCurrentEmail();
    if (!currentEmailAddress) {
        showStatus('没有可清除的邮箱', 'error');
        return;
    }

    // 确认删除
    if (!confirm(`确定要删除邮箱 ${currentEmailAddress} 吗？\n\n此操作将：\n- 删除Cloudflare中的邮箱路由\n- 删除数据库中的所有邮件记录\n- 删除临时邮箱记录\n\n此操作不可撤销！`)) {
        return;
    }

    const clearBtn = document.querySelector('.clear-btn');
    const originalText = clearBtn.textContent;

    console.log('=== 开始删除邮箱 ===');
    console.log('删除邮箱:', currentEmailAddress);

    // 禁用按钮并显示加载状态
    clearBtn.disabled = true;
    clearBtn.innerHTML = '<span class="loading"></span>删除中...';

    try {
        console.log('准备发送请求到Delete_edu_cloudfare云函数...');
        const requestBody = {
            email: currentEmailAddress
        };
        console.log('请求体:', JSON.stringify(requestBody, null, 2));

        const response = await fetch('云函数链接Delete_edu_cloudfare', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(requestBody)
        });

        console.log('收到响应:', response);
        console.log('响应状态:', response.status);

        const responseText = await response.text();
        console.log('响应文本:', responseText);

        let data;
        try {
            data = JSON.parse(responseText);
            console.log('解析后的响应数据:', JSON.stringify(data, null, 2));

            // 检查是否存在嵌套的JSON字符串
            if (data.body && typeof data.body === 'string') {
                console.log('检测到嵌套JSON字符串，进行二次解析...');
                try {
                    const innerData = JSON.parse(data.body);
                    console.log('二次解析后的数据:', JSON.stringify(innerData, null, 2));
                    data = innerData;
                } catch (innerParseError) {
                    console.error('嵌套JSON解析失败:', innerParseError);
                    throw new Error('嵌套响应数据格式错误');
                }
            }
        } catch (parseError) {
            console.error('JSON解析失败:', parseError);
            throw new Error(`响应格式错误: ${responseText}`);
        }

        if (data.success) {
            console.log('邮箱删除成功');

            // 清除本地数据
            currentEmail = null;
            localStorage.removeItem('tempEmail');
            localStorage.removeItem('tempEmailCreatedAt');

            // 隐藏显示区域
            document.getElementById('emailDisplay').classList.remove('show');
            document.getElementById('emailContent').classList.remove('show');

            // 显示详细的删除结果
            let successMessage = data.message;
            if (data.summary) {
                successMessage += `\n详细信息：\n- Cloudflare路由: ${data.summary.cloudflareRoutes} 个\n- 邮件记录: ${data.summary.emailRecords} 条\n- 邮箱记录: ${data.summary.tempEmailRecords} 条`;
            }

            showStatus(successMessage, 'success');
            console.log('邮箱已完全清除');

        } else {
            console.error('邮箱删除失败:', data);
            let errorMessage = data.error || data.message || '删除失败';

            // 显示详细的错误信息
            if (data.details) {
                errorMessage += '\n详细错误：';
                if (!data.details.cloudflare.success) {
                    errorMessage += `\n- Cloudflare: ${data.details.cloudflare.message}`;
                }
                if (!data.details.emailData.success) {
                    errorMessage += `\n- 邮件数据: ${data.details.emailData.message}`;
                }
                if (!data.details.tempEmails.success) {
                    errorMessage += `\n- 邮箱记录: ${data.details.tempEmails.message}`;
                }
            }

            showStatus(errorMessage, 'error');
        }

    } catch (error) {
        console.error('=== 删除邮箱失败 ===');
        console.error('错误详情:', error);

        let errorMessage = '删除邮箱失败';
        if (error.message) {
            errorMessage += `: ${error.message}`;
        }
        if (error.name === 'TypeError' && error.message.includes('fetch')) {
            errorMessage = '网络连接失败，请检查网络或稍后重试';
        }

        console.log('显示错误消息:', errorMessage);
        showStatus(errorMessage, 'error');

    } finally {
        // 恢复按钮状态
        clearBtn.disabled = false;
        clearBtn.textContent = originalText;
        console.log('=== 删除邮箱操作完成 ===');
    }
}

function showStatus(message, type) {
    const status = document.getElementById('status');
    status.textContent = message;
    status.className = `status ${type}`;
    status.style.display = 'block';

    // 3秒后自动隐藏
    setTimeout(() => {
        status.style.display = 'none';
    }, 3000);
}

async function copyEmail() {
    const emailAddress = document.getElementById('emailAddress').textContent;

    try {
        await navigator.clipboard.writeText(emailAddress);
        showStatus('邮箱地址已复制到剪贴板！', 'success');
    } catch (error) {
        // 降级方案：使用传统方法复制
        const textArea = document.createElement('textarea');
        textArea.value = emailAddress;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        showStatus('邮箱地址已复制到剪贴板！', 'success');
    }
}

// 更新邮箱状态信息的函数
function updateEmailInfo(email, timestamp) {
    const emailInfo = document.getElementById('emailInfo');
    emailInfo.textContent = `邮箱地址: ${email}\n创建时间: ${new Date(timestamp).toLocaleString()}`;
    emailInfo.className = 'email-info'; // 确保默认样式
    if (hasValidEmail()) {
        emailInfo.classList.add('valid');
        emailInfo.classList.remove('expired');
    } else {
        emailInfo.classList.add('expired');
        emailInfo.classList.remove('valid');
    }
}

// 查看最新邮件的函数
async function viewLatestEmail() {
    const currentEmailAddress = getCurrentEmail();
    if (!currentEmailAddress) {
        showStatus('请先生成邮箱地址', 'error');
        return;
    }

    const viewEmailBtn = document.getElementById('viewEmailBtn');
    const emailContent = document.getElementById('emailContent');
    const emailDetails = document.getElementById('emailDetails');

    console.log('=== 开始查看邮件 ===');
    console.log('查询邮箱:', currentEmailAddress);

    // 禁用按钮并显示加载状态
    const originalText = viewEmailBtn.textContent;
    viewEmailBtn.disabled = true;
    viewEmailBtn.innerHTML = '<span class="loading"></span>查询中...';

    try {
        console.log('准备发送请求到GET_cloudflare_edukg_email云函数...');
        const requestBody = {
            email: currentEmailAddress
        };
        console.log('请求体:', JSON.stringify(requestBody, null, 2));

        const response = await fetch('云函数链接GET_cloudflare_edukg_email', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(requestBody)
        });

        console.log('收到响应:', response);
        console.log('响应状态:', response.status);

        const responseText = await response.text();
        console.log('响应文本:', responseText);

        let data;
        try {
            data = JSON.parse(responseText);
            console.log('解析后的响应数据:', JSON.stringify(data, null, 2));

            // 检查是否存在嵌套的JSON字符串
            if (data.body && typeof data.body === 'string') {
                console.log('检测到嵌套JSON字符串，进行二次解析...');
                try {
                    const innerData = JSON.parse(data.body);
                    console.log('二次解析后的数据:', JSON.stringify(innerData, null, 2));
                    data = innerData;
                } catch (innerParseError) {
                    console.error('嵌套JSON解析失败:', innerParseError);
                    throw new Error('嵌套响应数据格式错误');
                }
            }
        } catch (parseError) {
            console.error('JSON解析失败:', parseError);
            throw new Error(`响应格式错误: ${responseText}`);
        }

        if (data.success && data.data) {
            console.log('成功获取邮件数据');
            displayEmailContent(data.data);
            emailContent.classList.add('show');
            showStatus('成功获取最新邮件', 'success');
        } else {
            console.log('未找到邮件或查询失败:', data.message);
            displayNoEmailMessage(data.message || '暂无邮件');
            emailContent.classList.add('show');
            showStatus(data.message || '暂无邮件', 'error');
        }

    } catch (error) {
        console.error('=== 查看邮件失败 ===');
        console.error('错误详情:', error);

        let errorMessage = '查询邮件失败';
        if (error.message) {
            errorMessage += `: ${error.message}`;
        }
        if (error.name === 'TypeError' && error.message.includes('fetch')) {
            errorMessage = '网络连接失败，请检查网络或稍后重试';
        }

        console.log('显示错误消息:', errorMessage);
        showStatus(errorMessage, 'error');
        displayNoEmailMessage(errorMessage);
        emailContent.classList.add('show');

    } finally {
        // 恢复按钮状态
        viewEmailBtn.disabled = false;
        viewEmailBtn.textContent = originalText;
        console.log('=== 查看邮件完成 ===');
    }
}

// 显示邮件内容的函数
function displayEmailContent(emailData) {
    const emailDetails = document.getElementById('emailDetails');

    const formatDate = (dateString) => {
        try {
            return new Date(dateString).toLocaleString('zh-CN');
        } catch (e) {
            return dateString;
        }
    };

    const emailHtml = `
        <div class="email-field">
            <span class="email-field-label">主题:</span>
            <span class="email-field-value">${emailData.emailSubject || '无主题'}</span>
        </div>
        <div class="email-field">
            <span class="email-field-label">发件人:</span>
            <span class="email-field-value">${emailData.emailFrom || '未知'}</span>
        </div>
        <div class="email-field">
            <span class="email-field-label">收件人:</span>
            <span class="email-field-value">${emailData.emailTo || '未知'}</span>
        </div>
        <div class="email-field">
            <span class="email-field-label">时间:</span>
            <span class="email-field-value">${formatDate(emailData.emailDate)}</span>
        </div>
        <div class="email-field">
            <span class="email-field-label">类型:</span>
            <span class="email-field-value">${emailData.emailType || '普通邮件'}</span>
        </div>
        <div class="email-body">
            ${emailData.emailHtml ?
                `<iframe srcdoc="${emailData.emailHtml.replace(/"/g, '&quot;')}" style="width: 100%; min-height: 300px; border: none;"></iframe>` :
                `<div class="email-text">${emailData.emailText || '无邮件内容'}</div>`
            }
        </div>
    `;

    emailDetails.innerHTML = emailHtml;
}

// 显示无邮件消息的函数
function displayNoEmailMessage(message) {
    const emailDetails = document.getElementById('emailDetails');
    emailDetails.innerHTML = `<div class="no-email-message">${message}</div>`;
}

// 响应式布局调整函数
function handleResponsiveLayout() {
    const container = document.querySelector('.main-container');
    const authorSection = document.querySelector('.author-section');
    const screenWidth = window.innerWidth;

    // 根据屏幕宽度动态调整布局
    if (screenWidth < 768) {
        // 小屏幕：垂直布局
        container.style.flexDirection = 'column';
        if (authorSection) {
            authorSection.style.width = '100%';
            authorSection.style.maxWidth = '500px';
            authorSection.style.margin = '0 auto';
        }
    } else if (screenWidth < 992) {
        // 中等屏幕：垂直布局，但限制最大宽度
        container.style.flexDirection = 'column';
        if (authorSection) {
            authorSection.style.width = '100%';
            authorSection.style.maxWidth = '400px';
            authorSection.style.margin = '0 auto';
        }
    } else {
        // 大屏幕：水平布局
        container.style.flexDirection = 'row';
        if (authorSection) {
            authorSection.style.width = screenWidth > 1200 ? '320px' : '280px';
            authorSection.style.maxWidth = 'none';
            authorSection.style.margin = '0';
        }
    }
}

// 优化触摸设备体验
function handleTouchOptimization() {
    if ('ontouchstart' in window || navigator.maxTouchPoints > 0) {
        // 为触摸设备增加更大的点击区域
        const buttons = document.querySelectorAll('button');
        buttons.forEach(button => {
            button.style.minHeight = '44px'; // iOS推荐的最小触摸目标
            button.style.padding = '12px 20px';
        });

        // 优化按钮组在触摸设备上的间距
        const buttonGroup = document.querySelector('.button-group');
        if (buttonGroup && window.innerWidth < 768) {
            buttonGroup.style.gap = '12px';
        }
    }
}

// 处理设备方向变化
function handleOrientationChange() {
    setTimeout(() => {
        handleResponsiveLayout();
        handleTouchOptimization();
    }, 100); // 给设备时间完成方向切换
}

// 页面加载完成后的初始化
document.addEventListener('DOMContentLoaded', function() {
    console.log('临时邮箱生成器已加载');

    // 检查是否有保存的邮箱
    const savedEmail = localStorage.getItem('tempEmail');
    if (savedEmail && hasValidEmail()) {
        currentEmail = savedEmail;
        document.getElementById('emailAddress').textContent = savedEmail;
        document.getElementById('emailDisplay').classList.add('show');

        // 显示保存的邮箱状态信息
        const savedTimestamp = localStorage.getItem('tempEmailCreatedAt');
        if (savedTimestamp) {
            updateEmailInfo(savedEmail, parseInt(savedTimestamp));
        }

        console.log('恢复保存的邮箱:', savedEmail);
    }

    // 监听邮箱生成事件
    window.addEventListener('emailGenerated', function(event) {
        console.log('邮箱生成事件触发:', event.detail);
        // 这里可以添加其他逻辑，比如通知其他组件、记录日志等
    });

    // 初始化响应式布局
    handleResponsiveLayout();
    handleTouchOptimization();

    // 监听窗口大小变化
    window.addEventListener('resize', handleResponsiveLayout);

    // 监听设备方向变化
    window.addEventListener('orientationchange', handleOrientationChange);

    // 监听视窗大小变化（用于处理虚拟键盘等情况）
    if (window.visualViewport) {
        window.visualViewport.addEventListener('resize', () => {
            // 处理移动设备虚拟键盘弹出时的布局调整
            if (window.visualViewport.height < window.innerHeight * 0.7) {
                document.body.style.height = `${window.visualViewport.height}px`;
            } else {
                document.body.style.height = 'auto';
            }
        });
    }

    // 添加键盘导航支持
    document.addEventListener('keydown', function(e) {
        // 支持Tab键在按钮间切换
        if (e.key === 'Tab') {
            const focusableElements = document.querySelectorAll('button:not(:disabled), [tabindex]:not([tabindex="-1"])');
            const currentIndex = Array.from(focusableElements).indexOf(document.activeElement);

            if (e.shiftKey) {
                // Shift+Tab：向前切换
                if (currentIndex > 0) {
                    focusableElements[currentIndex - 1].focus();
                } else {
                    focusableElements[focusableElements.length - 1].focus();
                }
            } else {
                // Tab：向后切换
                if (currentIndex < focusableElements.length - 1) {
                    focusableElements[currentIndex + 1].focus();
                } else {
                    focusableElements[0].focus();
                }
            }
        }

        // 支持Enter键激活当前焦点按钮
        if (e.key === 'Enter' && document.activeElement.tagName === 'BUTTON') {
            e.preventDefault();
            document.activeElement.click();
        }
    });

    // 添加无障碍支持
    const buttons = document.querySelectorAll('button');
    buttons.forEach(button => {
        // 为按钮添加合适的ARIA标签
        if (!button.getAttribute('aria-label')) {
            button.setAttribute('aria-label', button.textContent.trim());
        }

        // 为禁用状态的按钮添加说明
        const observer = new MutationObserver(() => {
            if (button.disabled) {
                button.setAttribute('aria-disabled', 'true');
            } else {
                button.removeAttribute('aria-disabled');
            }
        });
        observer.observe(button, { attributes: true, attributeFilter: ['disabled'] });
    });

    console.log('响应式优化和无障碍功能已初始化');
});
