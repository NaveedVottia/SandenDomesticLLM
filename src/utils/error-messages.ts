
interface ErrorMapping {
  [key: string]: {
    userMessage: string;
    suggestions: string[];
  };
}

const errorMappings: ErrorMapping = {
  'NETWORK_ERROR': {
    userMessage: '申し訳ありません。ネットワーク接続に問題が発生しています。',
    suggestions: [
      'インターネット接続を確認してください',
      'しばらく待ってから再度お試しください',
      '問題が続く場合はカスタマーサポートまでお問い合わせください'
    ]
  },
  'DATABASE_ERROR': {
    userMessage: '申し訳ありません。データベースに一時的な問題が発生しています。',
    suggestions: [
      '数分待ってから再度お試しください',
      '情報が正しく入力されているか確認してください'
    ]
  },
  'TIMEOUT_ERROR': {
    userMessage: '申し訳ありません。処理がタイムアウトしました。',
    suggestions: [
      '再度お試しください',
      '問題が続く場合はよりシンプルなクエリでお試しください'
    ]
  },
  'TOOL_ERROR': {
    userMessage: '申し訳ありません。システムで一時的なエラーが発生しています。',
    suggestions: [
      '数秒待ってから再度お試しください',
      '別の方法で情報を検索してみてください'
    ]
  }
};

function getUserFriendlyError(errorCode: string): { message: string; suggestions: string[] } {
  const mapping = errorMappings[errorCode] || errorMappings['TOOL_ERROR'];

  return {
    message: mapping.userMessage,
    suggestions: mapping.suggestions
  };
}

// Usage example:
// const error = getUserFriendlyError('NETWORK_ERROR');
// console.log(error.message);
// error.suggestions.forEach(suggestion => console.log(`- ${suggestion}`));
