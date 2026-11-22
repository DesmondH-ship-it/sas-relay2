# SAS 自評結果電郵：自助上架與開啟步驟（2026-11-21）

## 現況

已完成的（不用再做）：
- Tally 表單 4a7YVA 已上線：計分、分組、五個結果頁連結都建好了。
- 四個結果頁已發佈：/sas-women-basics、/sas-basics、/sas-basics-movement、/sas-movement。
- Wix 已建好五個聯絡人標籤：SAS group A、B、Dual、C、D。
- 發件地址 DesmondH@dailycalihk.com 已在 Wix 驗證完成（三個地址都已驗證，可直接發送）。
- 轉接器程式寫好，通過 28 項離線測試：計分、分組、簽名驗證、防重複發送、未開啟時只記錄不發送、四個結果頁有任何一個讀不到時扣住結果不發。

尚欠的（只有你能做）：把轉接器放到網上、填入兩把金鑰、做五次測試、最後開啟。全程約 30 分鐘。

## 第 1 步：上載程式到 GitHub（約 8 分鐘）

1. 在電腦下載 relay-kit.zip，解壓。
2. 到 github.com 用 Gmail 註冊（免費）。
3. 右上角 + → New repository。名稱 sas-relay，揀 Public，按 Create。
4. 在新倉庫頁面按「uploading an existing file」，把解壓出來的所有檔案（連 out 資料夾）拖進去，按 Commit changes。

## 第 2 步：建立 Wix API 金鑰（約 3 分鐘）

1. 登入 wix.com，到帳戶設定裡的「API Keys」建立新金鑰，名稱隨意（例如 sas-relay）。
2. 權限勾選：Contacts 類別的讀取與管理（Read Contacts、Manage Contacts）、Manage Contact Labels，以及 Email Marketing 類別的發送權限（Send emails 或 Manage Email Marketing）。
3. 建好後複製金鑰。只會顯示一次，先貼在記事本。

## 第 3 步：在 Render 開一個免費 Web Service（約 10 分鐘）

1. 到 render.com，用剛才的 GitHub 帳戶登入。
2. New + → Web Service → 選 sas-relay 倉庫 → Connect。
3. 設定：Language 選 Node；Start Command 填 `node server.mjs`；Instance Type 選 Free。
4. 在 Environment Variables 加入以下全部（大小寫要一樣）：

| 名稱 | 值 |
|---|---|
| SIGNING_SECRET | 先留空，第 4 步回來填 |
| WIX_ACCESS_TOKEN | 貼上第 2 步的 Wix 金鑰 |
| RELAY_ENABLED | 填 false（先不開） |
| SENDER_EMAIL | DesmondH@dailycalihk.com |
| SENDER_NAME | DAILYCALI |
| LABEL_A | custom.sas-group-a-5z2bm |
| LABEL_B | custom.sas-group-b-oEPTl |
| LABEL_DUAL | custom.sas-group-dual-58zz4 |
| LABEL_C | custom.sas-group-c-Qp2pw |
| LABEL_D | custom.sas-group-d-Mgcft |
| LABEL_ALL | 想所有 SAS 聯絡人再加一個標籤就填（例如 custom.join-our-mailing-list）；不想就留空 |
| REPLAY_KEY | 自己作一個難猜的字串（例如亂打 20 個字元），補發 Darlena 時用 |

5. 按 Create Web Service，等幾分鐘到出現 Live，記下上方的網址（https://開頭）。
6. 瀏覽器開 https://你的網址/healthz，見到 ok 就成功。

## 第 4 步：在 Tally 接上 webhook（約 2 分鐘）

1. 到 tally.so 開表單 4a7YVA → Settings → Integrations → Webhooks。
2. 新增 webhook，網址填 https://你的-render-網址/webhook。
3. 儲存後把顯示的 signing secret 複製，回到 Render 的 Environment Variables，填入 SIGNING_SECRET。

## 第 5 步：測試（relay 未開，不會真的發送）

重要：表單目前設有「同一 email 不可重複提交」。測試前先到 Tally 的表單設定暫時關閉重複提交限制，測完記得重新開啟。另一個方法是準備五個不同電郵地址。

- 先開 https://你的網址/healthz 確認 relayEnabled 是 false。
- 用自己的地址照下面的 T-A 至 T-I 答案各填一次。每次提交後：
  - Tally 感謝頁應顯示對應組別的結果塊和連結。
  - Render 的 Log 頁應出現一行 held（表示收到並扣住，沒有發送）。
- T-I 是負面測試：不剔健康同意框，表單應該不讓你提交。

### T-A（預期 0 分，A 組，結果頁 Women Basics）
性別：Female。Q3 第一格（Healthy）。Q4 第一格（少於 5 下嚴格掌上壓）。Q5 第一格（從未試過 dips）。Q6 第一格（未能做 1 下引體）。Q7 只剔 Long-term health。Q7a 第一格（Full-body flexibility and joint mobility）。

### T-B（預期 5 分，Dual，結果頁 Movement foundation and Basics conditioning）
性別：Male。Q3 第一格。Q4 第三格（13 to 19 strict push-ups）。Q5 第二格（輔助帶 dips）。Q6 第一格。Q7 只剔 Strength gains。Q7a 第二格（Foundational upper-body or lower-body strength）。Q7b 揀 Strict pull-up。

### T-C（預期 6 分，C 組，結果頁 Movement foundation）
性別：Female。Q3 第一格。Q4 第三格。Q5 第三格（3 to 7 strict, full range unassisted dips）。Q6 第二格（1 to 4 strict, unassisted pull-ups）。Q7 只剔 Strength gains。Q7a 第一格。

### T-D（預期 10 分，D 組，結果頁 Movement）
性別：Prefer not to say。Q3 第一格。Q4 第四格（20 or more）。Q5 第四格（8 or more）。Q6 第三格（5 or more）。Q7 只剔 Strength gains。Q7a 第三格（Full-body coordination and advanced bodyweight control）。

### T-E（預期封頂 5 分，Dual，電郵有關節照顧段落）
性別：Male。Q3 第三格（手術或目前疼痛）。Q4 第三格。Q5 第四格。Q6 第三格。Q7 只剔 Strength gains。Q7a 第二格。

### T-F（預期 0 分，A 組，電郵有關節照顧段落）
性別：Female。Q3 第三格。Q4 第一格。Q5 第一格。Q6 第一格。Q7 只剔 Long-term health。Q7a 第一格。

### T-G（預期 4 分，A 組，電郵有關節照顧段落）
性別：Female。Q3 第三格。Q4 第四格。Q5 第三格。Q6 第一格。Q7 只剔 Long-term health。Q7a 第一格。

### T-H（預期 2 分，B 組，電郵開頭會寫入你揀的目標動作）
性別：Male。Q3 第一格。Q4 第一格。Q5 第一格。Q6 第一格。Q7 兩格都剔。Q7a 第二格。Q7b 揀 Planche。

### T-I（負面測試：提交應被擋）
正常填，但不剔健康同意（health）那個框，按提交。表單應該不讓你送出。

（Q8 障礙、Q9 經驗不計分，每次隨便揀。）

## 第 6 步：開啟 + 補發 Darlena

1. 在 Render 把 RELAY_ENABLED 改成 true。改完會自動重新部署。
2. 用一個新的電郵地址再填一次表單（例如 T-H 的組合）。幾分鐘內該地址應收到由 DesmondH@dailycalihk.com 發出的結果電郵，Wix 聯絡人也會出現 SAS 標籤。
3. 補發 Darlena 的 A 組結果：瀏覽器開 https://你的網址/replay?key=你的-REPLAY_KEY。見到 group A 即已送出。再開一次會顯示 duplicate，屬正常。
4. 回 Tally 重新開啟重複提交限制。

## 免費版須知

Render 免費版 15 分鐘沒有流量就會睡眠，睡眠中收到的第一個提交可能收不到。兩個處理方法：到 cron-job.org 免費設定每 10 分鐘 ping 一次 https://你的網址/healthz；或升級 Render 付費方案（約每月 7 美元）。萬一真的漏了一筆，Tally 的 submissions 頁仍看得到答案，告訴 Symphony 就可以像 Darlena 那樣補發。

## 安全須知

- Wix 金鑰、Tally signing secret、REPLAY_KEY 三樣只填在 Render 的環境變數，不要貼在對話或訊息裡。
- 程式預設關閉（RELAY_ENABLED 不填或填 false 時只記錄不發送）。
- 每個提交只會處理一次，重啟也不會重發。
