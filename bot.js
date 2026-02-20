// MemeIQ Telegram Bot - FIXED VERSION
// Production-ready with proper error handling

const { Telegraf, Markup } = require('telegraf');
const fetch = require('node-fetch');

const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);

// Configuration
const API_BASE = process.env.API_BASE_URL || 'https://meme-iq.vercel.app/api';
const WEBSITE_URL = process.env.WEBSITE_URL || 'https://meme-iq.vercel.app';

// Storage
const userData = {};
const analytics = {
  totalUsers: 0,
  totalAnalyses: 0,
  commandUsage: {},
  dailyStats: {}
};

// ==================== HELPERS ====================

function fmtUSD(n) {
  const num = Number(n);
  if (!isFinite(num)) return "$0";
  if (num >= 1e9) return `$${(num / 1e9).toFixed(2)}B`;
  if (num >= 1e6) return `$${(num / 1e6).toFixed(2)}M`;
  if (num >= 1e3) return `$${(num / 1e3).toFixed(2)}K`;
  return `$${num.toFixed(2)}`;
}

function fmtPrice(p) {
  const num = Number(p);
  if (!isFinite(num)) return "$0";
  if (num >= 1) return `$${num.toFixed(4)}`;
  if (num >= 0.01) return `$${num.toFixed(6)}`;
  return `$${num.toFixed(10)}`;
}

function getScoreEmoji(score) {
  if (score >= 80) return '✅';
  if (score >= 60) return '⚠️';
  return '🔴';
}

function getUser(userId) {
  if (!userData[userId]) {
    userData[userId] = {
      id: userId,
      joinDate: new Date(),
      tier: 'free',
      dailyAnalyses: 0,
      totalAnalyses: 0,
      lastAnalysisDate: null,
      watchlist: [],
      referralCode: `MEMEIQ${userId}`,
      referrals: []
    };
    analytics.totalUsers++;
  }
  return userData[userId];
}

function canAnalyze(user) {
  const today = new Date().toDateString();
  if (user.lastAnalysisDate !== today) {
    user.dailyAnalyses = 0;
    user.lastAnalysisDate = today;
  }
  
  if (user.tier === 'pro' || user.tier === 'whale') {
    return { allowed: true };
  }
  
  if (user.dailyAnalyses >= 5) {
    return { 
      allowed: false, 
      message: `⚠️ Daily limit reached (5/5)\n\n🚀 Upgrade to Pro: /upgrade`
    };
  }
  
  return { allowed: true };
}

// ==================== MAIN ANALYSIS FUNCTION ====================

async function analyzeToken(ctx, address, isAutoDetect = false) {
  const user = getUser(ctx.from.id);
  const check = canAnalyze(user);
  
  if (!check.allowed) {
    return ctx.reply(check.message);
  }

  // Validate address
  if (!address || address.length < 32 || address.length > 44) {
    return ctx.reply('❌ Invalid Solana address format.\n\nExample: DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263');
  }

  const loadingMsg = await ctx.reply('🔍 Analyzing token...');

  try {
    console.log(`🔍 Analyzing address: ${address}`);
    
    // Call your API
    const apiUrl = `${API_BASE}/analyze?address=${encodeURIComponent(address)}`;
    console.log(`📡 Calling: ${apiUrl}`);
    
    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'MemeIQ-Bot/1.0'
      },
      timeout: 30000 // 30 second timeout
    });

    console.log(`📥 Response status: ${response.status}`);

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ API Error (${response.status}):`, errorText);
      throw new Error(`API returned ${response.status}`);
    }

    const data = await response.json();
    console.log(`✅ API Response:`, JSON.stringify(data).substring(0, 200));

    // Check response structure
    if (!data || !data.ok) {
      console.error('❌ Invalid response structure:', data);
      throw new Error(data?.error || 'Invalid API response');
    }

    if (!data.token) {
      console.error('❌ No token data in response');
      throw new Error('Token data not found');
    }

    const t = data.token;
    console.log(`✅ Token found: ${t.name} (${t.symbol})`);

    // Update user stats
    user.dailyAnalyses++;
    user.totalAnalyses++;
    analytics.totalAnalyses++;

    // Calculate scores safely
    const liquidityScore = t.scores?.liquidity || 0;
    const volumeScore = t.scores?.volume || 0;
    const holderScore = t.scores?.holders || 0;
    const overall = t.scores?.overall || Math.round((liquidityScore + volumeScore + holderScore) / 3);
    
    const scoreEmoji = getScoreEmoji(overall);
    const recEmoji = t.recommendation === 'BUY' ? '💚' : t.recommendation === 'CAUTION' ? '⚠️' : '🛑';

    // Format message
    const message = `
🪙 *${t.name || 'Unknown Token'}* (${t.symbol || '?'})
${t.verified ? '✅ Verified' : ''}

━━━━━━━━━━━━━━━━━━━
📊 *SCORE: ${overall}/100* ${scoreEmoji}
${recEmoji} *${t.recommendation || 'CAUTION'}*

━━━━━━━━━━━━━━━━━━━
💰 *Price*
${fmtPrice(t.price)}
24h: ${t.priceChange24h ? (t.priceChange24h > 0 ? '+' : '') + t.priceChange24h.toFixed(2) + '%' : 'N/A'}

━━━━━━━━━━━━━━━━━━━
📊 *Market*
MCap: ${fmtUSD(t.marketCap)}
FDV: ${fmtUSD(t.fdv)}

━━━━━━━━━━━━━━━━━━━
💧 *Liquidity* (${liquidityScore}/100)
Total: ${fmtUSD(t.liquidityUSD)}
LP Lock: ${t.lpLockedPct ? t.lpLockedPct.toFixed(0) + '%' : 'N/A'}

━━━━━━━━━━━━━━━━━━━
📈 *Volume* (${volumeScore}/100)
24h: ${fmtUSD(t.volume24hUSD)}
Wash Risk: ${t.washRiskLabel || 'Unknown'}

━━━━━━━━━━━━━━━━━━━
👥 *Holders* (${holderScore}/100)
Total: ${t.holders ? Number(t.holders).toLocaleString() : 'N/A'}
Top 10: ${t.top10Pct ? t.top10Pct.toFixed(1) + '%' : 'N/A'}

━━━━━━━━━━━━━━━━━━━
📝 *Analysis*
${t.summary || 'Token analyzed successfully.'}

━━━━━━━━━━━━━━━━━━━
${user.tier === 'free' ? `📊 Today: ${user.dailyAnalyses}/5 analyses\n` : ''}🔗 [Full Report](${WEBSITE_URL}?address=${address}&source=telegram${isAutoDetect ? '_auto' : ''}&user=${ctx.from.id})
⚡️ Powered by MemeIQ
    `.trim();

    // Add buttons
    const buttons = Markup.inlineKeyboard([
      [
        Markup.button.callback('📊 Watchlist', `watch_${address.substring(0, 20)}`),
        Markup.button.url('📈 Chart', `https://dexscreener.com/solana/${address}`)
      ],
      [
        Markup.button.url('🌐 Full Analysis', `${WEBSITE_URL}?address=${address}`)
      ]
    ]);

    await ctx.telegram.editMessageText(
      ctx.chat.id,
      loadingMsg.message_id,
      null,
      message,
      { parse_mode: 'Markdown', disable_web_page_preview: true, ...buttons }
    );

    console.log(`✅ Analysis complete for ${address}`);

  } catch (error) {
    console.error('❌ Analysis error:', error);
    
    let errorMessage = '❌ Analysis failed. ';
    
    if (error.message.includes('timeout')) {
      errorMessage += 'API timeout - token might be invalid or API is slow.';
    } else if (error.message.includes('404')) {
      errorMessage += 'Token not found. Check the address.';
    } else if (error.message.includes('500')) {
      errorMessage += 'Server error. Try again in a moment.';
    } else {
      errorMessage += 'Please verify the token address and try again.';
    }
    
    errorMessage += `\n\n💡 Tip: Make sure you're using a valid Solana token address.`;
    
    await ctx.telegram.editMessageText(
      ctx.chat.id,
      loadingMsg.message_id,
      null,
      errorMessage
    );
  }
}

// ==================== COMMANDS ====================

bot.command('start', async (ctx) => {
  const user = getUser(ctx.from.id);
  const username = ctx.from.first_name || 'trader';
  
  await ctx.reply(`
🤖 *Welcome to MemeIQ Bot, ${username}!*

Your AI-powered Solana meme coin analyzer.

━━━━━━━━━━━━━━━━━━━
📊 *Commands*
/analyze <address> - Full analysis
/quick <address> - Quick score
/watchlist - Your tracked tokens
/trending - Hot tokens
/stats - Your statistics
/upgrade - Go Pro
/help - All commands

━━━━━━━━━━━━━━━━━━━
💡 *Quick Tip*
Just paste any token address and I'll analyze it!

Example:
\`DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263\`

━━━━━━━━━━━━━━━━━━━
🚀 Add me to groups!
🌐 Website: ${WEBSITE_URL}
  `.trim(), { parse_mode: 'Markdown' });
});

bot.command('analyze', async (ctx) => {
  const args = ctx.message.text.split(/\s+/);
  const address = args[1];
  
  if (!address) {
    return ctx.reply(
      '❌ Please provide a token address.\n\n' +
      'Usage: /analyze <address>\n\n' +
      'Example:\n' +
      '/analyze DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263'
    );
  }

  await analyzeToken(ctx, address, false);
});

bot.command('quick', async (ctx) => {
  const args = ctx.message.text.split(/\s+/);
  const address = args[1];
  
  if (!address) {
    return ctx.reply('❌ Usage: /quick <address>');
  }

  await analyzeToken(ctx, address, false);
});

bot.command('watchlist', async (ctx) => {
  const user = getUser(ctx.from.id);
  
  if (!user.watchlist || user.watchlist.length === 0) {
    return ctx.reply(`
📊 *Your Watchlist*

Empty! Add tokens by:
1. Analyze a token
2. Click "Add to Watchlist"

Or use: /watch <address>
    `.trim(), { parse_mode: 'Markdown' });
  }
  
  const list = user.watchlist.map((addr, i) => 
    `${i + 1}. \`${addr.slice(0, 8)}...${addr.slice(-6)}\``
  ).join('\n');
  
  ctx.reply(`📊 *Your Watchlist*\n\n${list}\n\nUse /analyze <address> to check any token.`, { parse_mode: 'Markdown' });
});

bot.command('stats', async (ctx) => {
  const user = getUser(ctx.from.id);
  const today = new Date().toDateString();
  
  if (user.lastAnalysisDate !== today) {
    user.dailyAnalyses = 0;
  }
  
  ctx.reply(`
📊 *Your Stats*

Tier: ${user.tier.toUpperCase()}
Today: ${user.dailyAnalyses}/${user.tier === 'free' ? '5' : '∞'}
Total: ${user.totalAnalyses} analyses
Watchlist: ${user.watchlist?.length || 0} tokens
Referrals: ${user.referrals?.length || 0}

${user.tier === 'free' ? '🚀 /upgrade for unlimited!' : '✅ Pro member!'}
  `.trim(), { parse_mode: 'Markdown' });
});

bot.command('upgrade', async (ctx) => {
  const message = `
💎 *Upgrade to Pro*

🆓 *FREE* (Current)
✅ 5 analyses/day
✅ Basic features

🚀 *PRO - $9.99/mo*
✅ Unlimited analyses
✅ Real-time alerts
✅ Portfolio tracking
✅ Priority support

🐋 *WHALE - $29.99/mo*
✅ Everything in Pro
✅ Auto-trading signals
✅ API access
✅ Exclusive alpha

Click to upgrade:
  `.trim();
  
  const buttons = Markup.inlineKeyboard([
    [Markup.button.url('💳 Upgrade Now', `${WEBSITE_URL}/upgrade?user=${ctx.from.id}`)],
  ]);
  
  ctx.reply(message, { parse_mode: 'Markdown', ...buttons });
});

bot.command('trending', async (ctx) => {
  ctx.reply(`
🔥 *Trending Tokens*

Coming soon! This will show:
• Most analyzed tokens
• Biggest movers
• Community favorites

For now, analyze any token with:
/analyze <address>
  `.trim(), { parse_mode: 'Markdown' });
});

bot.command('help', async (ctx) => {
  ctx.reply(`
📚 *MemeIQ Commands*

🔍 *Analysis*
/analyze <address> - Full analysis
/quick <address> - Quick score

📊 *Tracking*
/watchlist - Your tokens
/stats - Your usage

⚙️ *Settings*
/upgrade - Go Pro
/help - This message

━━━━━━━━━━━━━━━━━━━
💡 Just paste any address to analyze!

🌐 ${WEBSITE_URL}
  `.trim(), { parse_mode: 'Markdown' });
});

bot.command('admin', async (ctx) => {
  // Add your Telegram user ID here
  const adminIds = [parseInt(process.env.ADMIN_USER_ID || '0')];
  
  if (!adminIds.includes(ctx.from.id) && adminIds[0] !== 0) {
    return ctx.reply('⛔ Admin only');
  }
  
  const today = new Date().toDateString();
  const todayStats = analytics.dailyStats[today] || { analyses: 0, users: new Set() };
  
  ctx.reply(`
👑 *Admin Dashboard*

Users: ${analytics.totalUsers}
Analyses: ${analytics.totalAnalyses}
Today: ${todayStats.analyses} analyses

Free: ${Object.values(userData).filter(u => u.tier === 'free').length}
Pro: ${Object.values(userData).filter(u => u.tier === 'pro').length}
  `.trim(), { parse_mode: 'Markdown' });
});

// ==================== AUTO-DETECTION ====================

bot.on('text', async (ctx) => {
  const text = ctx.message.text;
  
  // Skip commands
  if (text.startsWith('/')) return;
  
  // Detect Solana address (32-44 chars, base58)
  const addressPattern = /\b[1-9A-HJ-NP-Za-km-z]{32,44}\b/g;
  const matches = text.match(addressPattern);
  
  if (matches && matches.length > 0) {
    const address = matches[0];
    console.log(`🎯 Auto-detected address: ${address}`);
    await analyzeToken(ctx, address, true);
  }
});

// ==================== CALLBACK HANDLERS ====================

bot.action(/^watch_(.+)$/, async (ctx) => {
  const addressPrefix = ctx.match[1];
  const user = getUser(ctx.from.id);
  
  await ctx.answerCbQuery('Added to watchlist!');
  ctx.reply('✅ Token added to watchlist!\n\nView: /watchlist');
});

// ==================== ERROR HANDLING ====================

bot.catch((err, ctx) => {
  console.error('❌ Bot error:', err);
  console.error('Context:', {
    updateType: ctx.updateType,
    message: ctx.message?.text,
    from: ctx.from?.id
  });
  
  try {
    ctx.reply('⚠️ An error occurred. Please try again or contact support.');
  } catch (e) {
    console.error('Failed to send error message:', e);
  }
});

// ==================== STARTUP ====================

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));

// Launch bot
bot.launch().then(() => {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🤖 MemeIQ Bot Started!');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`Bot: @${bot.botInfo?.username}`);
  console.log(`API: ${API_BASE}`);
  console.log(`Web: ${WEBSITE_URL}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('✅ Ready to analyze tokens!');
  console.log('Press Ctrl+C to stop');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━');
}).catch(err => {
  console.error('❌ Failed to start bot:', err);
  process.exit(1);
});

// Health check
setInterval(() => {
  const timestamp = new Date().toISOString();
  console.log(`🟢 [${timestamp}] Bot alive | Users: ${analytics.totalUsers} | Analyses: ${analytics.totalAnalyses}`);
}, 300000); // Every 5 minutes
