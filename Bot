// MemeIQ Telegram Bot - Production Ready
// Connects to your meme-iq.vercel.app API

const { Telegraf } = require('telegraf');
const fetch = require('node-fetch');

const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);

// API Configuration
const API_BASE = 'https://meme-iq.vercel.app/api';

// Helper: Format large numbers
function fmtUSD(n) {
  const num = Number(n);
  if (!isFinite(num)) return "$0";
  if (num >= 1e9) return `$${(num / 1e9).toFixed(2)}B`;
  if (num >= 1e6) return `$${(num / 1e6).toFixed(2)}M`;
  if (num >= 1e3) return `$${(num / 1e3).toFixed(2)}K`;
  return `$${num.toLocaleString()}`;
}

function fmtPrice(p) {
  const num = Number(p);
  if (!isFinite(num)) return "$0";
  if (num >= 1) return `$${num.toFixed(4)}`;
  if (num >= 0.01) return `$${num.toFixed(6)}`;
  return `$${num.toFixed(10)}`;
}

// Helper: Get score emoji
function getScoreEmoji(score) {
  if (score >= 80) return '✅';
  if (score >= 60) return '⚠️';
  return '🔴';
}

// Helper: Get recommendation emoji
function getRecEmoji(rec) {
  if (rec === 'BUY') return '💚';
  if (rec === 'CAUTION') return '⚠️';
  return '🛑';
}

// ==================== COMMANDS ====================

// START - Welcome message
bot.command('start', (ctx) => {
  const username = ctx.from.first_name || 'trader';
  ctx.reply(`
🤖 Welcome to MemeIQ Bot, ${username}!

Your AI-powered meme coin analyzer.

📊 Commands:
/analyze <address> - Analyze token risk
/trending - Top tokens (coming soon)
/alert <address> - Set alerts (coming soon)
/help - Show all commands

💡 Example:
/analyze DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263

🚀 Add me to your group to analyze tokens together!

Made with ❤️ by MemeIQ
  `.trim());
});

// HELP - Command list
bot.command('help', (ctx) => {
  ctx.reply(`
📚 MemeIQ Bot Commands:

🔍 Analysis:
/analyze <address> - Full token analysis
/quick <address> - Quick risk score only

📊 Info:
/trending - Top analyzed tokens (soon)
/stats - Bot statistics (soon)

🔔 Alerts:
/alert <address> - Set price alerts (soon)
/myalerts - View your alerts (soon)

⚙️ Settings:
/start - Show welcome message
/help - Show this help

📖 Examples:
/analyze DezXAZ8z7...B263
/quick 7xKXtg2C...osgAsU

🌐 Web: https://meme-iq.vercel.app
💬 Support: @memeiq_support

Pro tip: Just send me a token address and I'll analyze it!
  `.trim());
});

// ANALYZE - Full token analysis
bot.command('analyze', async (ctx) => {
  const args = ctx.message.text.split(' ');
  const address = args[1];
  
  if (!address) {
    return ctx.reply(
      '❌ Please provide a token address.\n\n' +
      'Example: /analyze DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263'
    );
  }

  // Validate Solana address format
  if (address.length < 32 || address.length > 44) {
    return ctx.reply('❌ Invalid Solana address format.');
  }

  const loadingMsg = await ctx.reply('🔍 Analyzing token... Please wait 5-10 seconds.');

  try {
    const response = await fetch(`${API_BASE}/analyze?address=${address}`);
    const data = await response.json();

    if (!data.ok || !data.token) {
      await ctx.telegram.editMessageText(
        ctx.chat.id,
        loadingMsg.message_id,
        null,
        `❌ Analysis failed: ${data.error || 'Token not found or invalid address'}`
      );
      return;
    }

    const t = data.token;
    const overall = t.scores?.overall || 50;
    const scoreEmoji = getScoreEmoji(overall);
    const recEmoji = getRecEmoji(t.recommendation);

    // Format comprehensive analysis
    const message = `
🪙 *${t.name || 'Unknown'}* (${t.symbol || '?'})
${t.verified ? '✅ Verified' : ''}

━━━━━━━━━━━━━━━━━━━
📊 *OVERALL SCORE: ${overall}/100* ${scoreEmoji}
${recEmoji} *Recommendation: ${t.recommendation || 'CAUTION'}*

━━━━━━━━━━━━━━━━━━━
💰 *Price Action*
Current: ${fmtPrice(t.price)}
24h Change: ${t.priceChange24h?.toFixed(2) || '0'}%
Market Cap: ${fmtUSD(t.marketCap)}

━━━━━━━━━━━━━━━━━━━
💧 *Liquidity* (${t.scores?.liquidity || 0}/100)
Total: ${fmtUSD(t.liquidityUSD)}
LP Locked: ${t.lpLockedPct?.toFixed(0) || '0'}%
MCap/Liq: ${t.mcapLiqRatio || '0'}x

━━━━━━━━━━━━━━━━━━━
📈 *Volume* (${t.scores?.volume || 0}/100)
24h Volume: ${fmtUSD(t.volume24hUSD)}
Wash Risk: ${t.washRiskLabel || 'Unknown'}

━━━━━━━━━━━━━━━━━━━
👥 *Holders* (${t.scores?.holders || 0}/100)
Total: ${Number(t.holders || 0).toLocaleString()}
Top 10: ${t.top10Pct?.toFixed(1) || '0'}%
Risk: ${t.concentrationLabel || 'Unknown'}

━━━━━━━━━━━━━━━━━━━
📝 *AI Summary*
${t.summary || 'Analysis complete.'}

━━━━━━━━━━━━━━━━━━━
🔗 [Full Analysis](https://meme-iq.vercel.app?address=${address})
⚡️ Powered by MemeIQ AI
    `.trim();

    await ctx.telegram.editMessageText(
      ctx.chat.id,
      loadingMsg.message_id,
      null,
      message,
      { parse_mode: 'Markdown', disable_web_page_preview: true }
    );

  } catch (error) {
    console.error('Analysis error:', error);
    await ctx.telegram.editMessageText(
      ctx.chat.id,
      loadingMsg.message_id,
      null,
      '❌ Analysis failed. Please check the token address and try again.'
    );
  }
});

// QUICK - Quick score only
bot.command('quick', async (ctx) => {
  const args = ctx.message.text.split(' ');
  const address = args[1];
  
  if (!address) {
    return ctx.reply('❌ Usage: /quick <token_address>');
  }

  if (address.length < 32 || address.length > 44) {
    return ctx.reply('❌ Invalid Solana address format.');
  }

  const loadingMsg = await ctx.reply('⚡ Quick analyzing...');

  try {
    const response = await fetch(`${API_BASE}/analyze?address=${address}`);
    const data = await response.json();

    if (!data.ok || !data.token) {
      await ctx.telegram.editMessageText(
        ctx.chat.id,
        loadingMsg.message_id,
        null,
        '❌ Analysis failed.'
      );
      return;
    }

    const t = data.token;
    const overall = t.scores?.overall || 50;
    const scoreEmoji = getScoreEmoji(overall);

    const message = `
⚡ *Quick Analysis*

🪙 ${t.name || 'Unknown'} (${t.symbol || '?'})
📊 Score: *${overall}/100* ${scoreEmoji}
💰 Price: ${fmtPrice(t.price)}
💧 Liquidity: ${fmtUSD(t.liquidityUSD)}

${scoreEmoji} ${t.recommendation || 'CAUTION'}

[Full Analysis](https://meme-iq.vercel.app?address=${address})
    `.trim();

    await ctx.telegram.editMessageText(
      ctx.chat.id,
      loadingMsg.message_id,
      null,
      message,
      { parse_mode: 'Markdown', disable_web_page_preview: true }
    );

  } catch (error) {
    console.error('Quick analysis error:', error);
    await ctx.telegram.editMessageText(
      ctx.chat.id,
      loadingMsg.message_id,
      null,
      '❌ Quick analysis failed.'
    );
  }
});

// TRENDING - Coming soon
bot.command('trending', (ctx) => {
  ctx.reply(`
📊 *Trending Tokens*

🚧 Coming soon!

This feature will show:
• Most analyzed tokens (24h)
• Biggest score changes
• Community favorites
• Hot new launches

Stay tuned! 🚀
  `.trim(), { parse_mode: 'Markdown' });
});

// ALERT - Coming soon
bot.command('alert', (ctx) => {
  ctx.reply(`
🔔 *Price Alerts*

🚧 Coming soon!

Set custom alerts for:
• Price changes (±X%)
• Rug risk spikes
• Dev wallet activity
• Liquidity changes

Stay tuned! 🚀
  `.trim(), { parse_mode: 'Markdown' });
});

// ==================== MESSAGE HANDLERS ====================

// Auto-detect token addresses in messages
bot.on('text', async (ctx) => {
  const text = ctx.message.text;
  
  // Skip if it's a command
  if (text.startsWith('/')) return;
  
  // Detect Solana address pattern (32-44 chars, base58)
  const addressPattern = /\b[1-9A-HJ-NP-Za-km-z]{32,44}\b/;
  const match = text.match(addressPattern);
  
  if (match) {
    const address = match[0];
    
    // Quick inline analysis
    const loadingMsg = await ctx.reply(`🔍 Detected token address, analyzing...`);
    
    try {
      const response = await fetch(`${API_BASE}/analyze?address=${address}`);
      const data = await response.json();

      if (data.ok && data.token) {
        const t = data.token;
        const overall = t.scores?.overall || 50;
        const scoreEmoji = getScoreEmoji(overall);

        const message = `
🪙 *${t.name}* (${t.symbol})
📊 Score: *${overall}/100* ${scoreEmoji}
${scoreEmoji} ${t.recommendation}

💰 ${fmtPrice(t.price)} | MCap: ${fmtUSD(t.marketCap)}
💧 Liq: ${fmtUSD(t.liquidityUSD)} | LP: ${t.lpLockedPct?.toFixed(0)}%

${t.summary?.substring(0, 100) || ''}...

[Full Report](https://meme-iq.vercel.app?address=${address})
        `.trim();

        await ctx.telegram.editMessageText(
          ctx.chat.id,
          loadingMsg.message_id,
          null,
          message,
          { parse_mode: 'Markdown', disable_web_page_preview: true }
        );
      } else {
        await ctx.telegram.deleteMessage(ctx.chat.id, loadingMsg.message_id);
      }
    } catch (error) {
      await ctx.telegram.deleteMessage(ctx.chat.id, loadingMsg.message_id);
    }
  }
});

// ==================== ERROR HANDLING ====================

bot.catch((err, ctx) => {
  console.error('Bot error:', err);
  ctx.reply('⚠️ An error occurred. Please try again.');
});

// ==================== LAUNCH ====================

// Graceful shutdown
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));

// Start bot
bot.launch();

console.log('🤖 MemeIQ Bot is running!');
console.log('Bot username:', bot.botInfo?.username);
console.log('Press Ctrl+C to stop.');

// Keep alive ping
setInterval(() => {
  console.log('🟢 Bot alive:', new Date().toISOString());
}, 60000); // Every minute
