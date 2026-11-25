// Link önizlemesi üreten botlar (Telegram, WhatsApp, Facebook / Instagram, X, Slack, LinkedIn, Discord vb.).
// /davet/X: bu botlar dil yönlendirmesine ve kayıt sayfasına yönlendirilmez, davet sayfasının kendi meta verisini okur.
const BOTS = /TelegramBot|WhatsApp|facebookexternalhit|Facebot|meta-externalagent|Twitterbot|Slackbot|LinkedInBot|Discordbot|SkypeUriPreview|Pinterestbot|redditbot|vkShare|Viber|Snapchat|Iframely|Embedly|Applebot/i;

export function isLinkPreviewBot(userAgent: string | null | undefined): boolean {
  return !!userAgent && BOTS.test(userAgent);
}
