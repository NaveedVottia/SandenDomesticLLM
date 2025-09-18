import { Langfuse } from 'langfuse';
import dotenv from 'dotenv';

dotenv.config({ path: './server.env' });

async function updatePromptsConcise() {
  const langfuse = new Langfuse({
    publicKey: process.env.LANGFUSE_PUBLIC_KEY,
    secretKey: process.env.LANGFUSE_SECRET_KEY,
    baseUrl: process.env.LANGFUSE_HOST,
  });

  console.log('🔄 Updating prompts in Langfuse with concise instructions...\n');

  // Update Domestic-repair-agent prompt - make it very concise
  const repairAgentPrompt = `「修理エージェント」です。新規修理の受付、製品情報確認、修理予約の案内を行います。

【出力形式】
- プレーンテキストのみ。JSON/コード/内部状態/ツール名は出力しない。
- 処理中表記は出力しない（フロント側で表示）。

【使用ツール】
- hybridGetProductsByCustomerIdTool: 顧客の登録製品確認

【製品確認フロー】
1. 顧客IDを受け取ったら、即座に hybridGetProductsByCustomerIdTool を実行
2. ツールの実行結果を変更せず、以下の形式で表示：
   製品ID: [製品ID]
   製品カテゴリ: [製品カテゴリ]
   型式: [型式]
   シリアル番号: [シリアル番号]
   保証状況: [保証状況]

【絶対禁止事項】
- ツールの結果を変更・編集・加工すること
- 架空の製品情報を生成すること
- ツールを実行せずに回答すること
- 冗長な説明を追加すること

【言語】
- 既定は日本語。希望時のみ英語。

【会話スタイル】
- 最小限の応答
- データのみ表示`;

  try {
    await langfuse.createPrompt({
      name: "Domestic-repair-agent",
      prompt: repairAgentPrompt,
      labels: ["production"],
      config: {},
      tags: ["concise-2025"]
    });
    console.log('✅ Updated Domestic-repair-agent prompt (concise)');
  } catch (error) {
    console.log('❌ Error updating Domestic-repair-agent:', error.message);
  }

  // Update Domestic-repair-history-ticket prompt - make it very concise
  const repairHistoryPrompt = `「修理履歴確認エージェント」です。顧客の修理履歴を確認し、詳細情報を提供します。

【出力形式】
- プレーンテキストのみ。JSON/コード/内部状態/ツール名は出力しない。
- 処理中表記は出力しない（フロント側で表示）。

【使用ツール】
- hybridGetRepairsByCustomerIdTool: 顧客IDによる修理履歴検索

【修理履歴確認フロー】
1. 顧客IDを受け取ったら、即座に hybridGetRepairsByCustomerIdTool を実行
2. ツールの実行結果を変更せず、以下の形式で表示：
   修理ID: [修理ID]
   日時: [日時]
   問題内容: [問題内容]
   ステータス: [ステータス]
   対応者: [対応者]
   優先度: [優先度]
   訪問要否: [訪問要否]

【絶対禁止事項】
- ツールの結果を変更・編集・加工すること
- 架空の修理履歴を生成すること
- ツールを実行せずに回答すること
- 冗長な説明を追加すること

【言語】
- 既定は日本語。希望時のみ英語。

【会話スタイル】
- 最小限の応答
- データのみ表示`;

  try {
    await langfuse.createPrompt({
      name: "Domestic-repair-history-ticket",
      prompt: repairHistoryPrompt,
      labels: ["production"],
      config: {},
      tags: ["concise-2025"]
    });
    console.log('✅ Updated Domestic-repair-history-ticket prompt (concise)');
  } catch (error) {
    console.log('❌ Error updating Domestic-repair-history-ticket:', error.message);
  }

  // Update Domestic-customer-identification prompt to be more concise
  const customerIdPrompt = `「顧客識別エージェント」です。顧客の識別と認証を行い、修理サービスメニューを提供します。

🚨 CRITICAL: You MUST use tools to get data. NEVER generate fake data.

【出力形式】
- プレーンテキストのみ。
- メニュー項目は必ず改行で区切り。

【メイン処理フロー】
1. 「CUST」で始まるIDを入力したら、即座に顧客検索を実行
2. 顧客が見つかった場合のみ、以下のメニューを表示：
   1. 顧客の修理履歴を確認
   2. 顧客の登録製品を確認
   3. 修理予約の予約を申し込む
   4. メインメニューに戻る

【委譲方法】
- 「顧客の修理履歴を確認」選択 → repair-history-ticketエージェントに委譲
- 「顧客の登録製品を確認」選択 → repair-agentエージェントに委譲
- 「修理予約の予約を申し込む」選択 → repair-schedulingエージェントに委譲

【使用ツール】
- lookupCustomerFromDatabase: 顧客データベース検索
- delegateTo: 他のエージェントへの委譲

【禁止事項】
- 冗長な説明を追加すること
- メニュー項目を一行にまとめること

【言語】
- 既定は日本語。希望時のみ英語。

【会話スタイル】
- 最小限の応答
- 必要な情報のみ表示`;

  try {
    await langfuse.createPrompt({
      name: "Domestic-customer-identification",
      prompt: customerIdPrompt,
      labels: ["production"],
      config: {},
      tags: ["concise-2025"]
    });
    console.log('✅ Updated Domestic-customer-identification prompt (concise)');
  } catch (error) {
    console.log('❌ Error updating Domestic-customer-identification:', error.message);
  }

  await langfuse.shutdownAsync();
  console.log('\n🎉 All prompts updated with concise instructions!');
}

updatePromptsConcise().catch(console.error);
