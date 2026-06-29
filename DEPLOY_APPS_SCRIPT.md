# Apps Script 部署方式

## 1. 準備試算表

試算表可命名為 `車價查詢資料庫`

工作表建議命名為 `車輛資料`

第一列欄位名稱：

`車號`, `品牌`, `車型`, `年份`, `排氣量`, `顏色`, `里程數`, `一手車`, `車況`, `車況備注`, `車輛照片`, `售價`, `發票`

## 2. 建立 Apps Script

1. 打開 Google 試算表
2. 點選 `擴充功能 > Apps Script`
3. 把 [apps-script.gs](/C:/Users/User/Documents/Codex/2026-06-29/new-chat/outputs/apps-script.gs) 的內容完整貼上
4. 將 `spreadsheetId` 改成你的試算表 ID
5. 若工作表名稱不是 `車輛資料`，同步修改 `sheetName`

試算表 ID 範例：

`https://docs.google.com/spreadsheets/d/這一段就是ID/edit`

## 3. 部署成 Web App

1. 點右上角 `部署`
2. 選 `新增部署作業`
3. 類型選 `網頁應用程式`
4. 執行身分選 `我`
5. 存取權限選 `任何知道連結的人`
6. 部署後複製 Web App URL

## 4. 前端設定

打開 [app.js](/C:/Users/User/Documents/Codex/2026-06-29/new-chat/outputs/app.js)

把：

`apiUrl: ""`

改成：

`apiUrl: "你的 Apps Script Web App URL"`

## 5. 重新部署 Apps Script

若之後有改 Apps Script：

1. 點 `部署`
2. 管理部署作業
3. 編輯目前的網頁應用程式部署
4. 建立新版本後更新

## 6. 注意

- 試算表本身不用公開
- 只有 Web App URL 會被前端呼叫
- 若前端仍讀不到，通常是 Web App 沒更新到最新版
