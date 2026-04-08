# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: e2e-auth-guard.test.ts >> Auth Guard E2E >> 7. Expired/invalid token → API 401
- Location: e2e-auth-guard.test.ts:131:3

# Error details

```
Error: page.evaluate: TypeError: Failed to fetch
    at window.fetch (http://localhost:5180/src/hooks/usePerformanceMetrics.ts:113:32)
    at eval (eval at evaluate (:302:30), <anonymous>:4:23)
    at UtilityScript.evaluate (<anonymous>:304:16)
    at UtilityScript.<anonymous> (<anonymous>:1:44)
```

# Page snapshot

```yaml
- generic [ref=e4]:
  - generic [ref=e5]:
    - generic [ref=e7]: 📊
    - heading "VeighNa Web" [level=1] [ref=e8]
    - paragraph [ref=e9]: 量化交易系统 · 智能投资平台
  - generic [ref=e10]:
    - heading "用户登录" [level=2] [ref=e11]
    - generic [ref=e12]:
      - generic [ref=e13]:
        - generic [ref=e14]: 用户名
        - generic [ref=e15]:
          - generic [ref=e16]: 👤
          - textbox "用户名" [ref=e17]:
            - /placeholder: 请输入用户名
      - generic [ref=e18]:
        - generic [ref=e19]: 密码
        - generic [ref=e20]:
          - generic [ref=e21]: 🔒
          - textbox "密码" [ref=e22]:
            - /placeholder: 请输入密码
          - button "显示密码" [ref=e23]: 👁️
      - generic [ref=e25] [cursor=pointer]:
        - checkbox "记住登录状态" [ref=e26]
        - generic [ref=e27]: 记住登录状态
      - button "登 录" [ref=e28]
    - paragraph [ref=e30]: "测试账号: admin / admin123"
  - paragraph [ref=e31]: © 2026 VeighNa Quant · 安全交易 · 智慧投资
```