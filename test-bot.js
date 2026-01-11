require('dotenv').config();
const { Telegraf } = require('telegraf');

const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);
const CHANNEL_ID = process.env.TELEGRAM_CHANNEL_ID;

console.log('Bot Token:', process.env.TELEGRAM_BOT_TOKEN ? 'موجود ✓' : 'غير موجود ❌');
console.log('Channel ID:', CHANNEL_ID);

async function test() {
  try {
    // اختبار البوت
    const me = await bot.telegram.getMe();
    console.log('\n✓ البوت يعمل:', me.username);
    
    // محاولة إرسال رسالة للقناة
    console.log('\nجاري إرسال رسالة تجريبية للقناة...');
    const msg = await bot.telegram.sendMessage(CHANNEL_ID, 'اختبار الاتصال ✓');
    console.log('✓ تم إرسال الرسالة بنجاح!');
    console.log('معرف القناة الصحيح:', msg.chat.id);
    
    // حذف الرسالة التجريبية
    await bot.telegram.deleteMessage(CHANNEL_ID, msg.message_id);
    console.log('✓ تم حذف الرسالة التجريبية');
    
  } catch (error) {
    console.error('\n❌ خطأ:', error.message);
    
    if (error.message.includes('chat not found')) {
      console.log('\n--- الحل ---');
      console.log('1. تأكد أن البوت مضاف كمشرف في القناة');
      console.log('2. أرسل أي رسالة في القناة ثم حولها لـ @userinfobot');
      console.log('3. استخدم المعرف الذي يبدأ بـ -100');
    }
  }
}

test();
