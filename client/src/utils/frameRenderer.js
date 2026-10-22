/**
 * Eventify Frame Compositor & Renderer
 * 
 * Provides Canvas 2D drawing methods to burn event frame overlays directly
 * into the recorded video stream in real-time, matching the 5 design templates:
 * - minimal: Semi-transparent dark glass bottom bar with clean typography
 * - bold: Full-width vibrant top & bottom header/footer banners
 * - elegant: Luxury bottom gradient with metallic accent divider line & serif fonts
 * - neon: Glowing cyberpunk outline border with neon drop-shadow text
 * - classic: TV broadcast lower-third chevron polygon banner
 */

// ── 1. Minimal Frame ────────────────────────────────────────────────────────
export function drawMinimalFrame(ctx, width, height, config, logoImg) {
  const barH = Math.round(height * 0.12);
  const y = height - barH;

  ctx.save();
  // Semi-transparent dark glass background
  ctx.fillStyle = 'rgba(10, 10, 18, 0.72)';
  ctx.fillRect(0, y, width, barH);

  // Top accent line
  ctx.fillStyle = config.primaryColor || '#7F77DD';
  ctx.fillRect(0, y, width, 3);

  let textX = 28;
  if (config.showLogo && logoImg && logoImg.complete && logoImg.naturalWidth > 0) {
    const logoSize = Math.round(barH * 0.62);
    const logoY = y + (barH - logoSize) / 2;
    try {
      ctx.drawImage(logoImg, textX, logoY, logoSize, logoSize);
      textX += logoSize + 16;
    } catch (_) {}
  }

  // Event title
  if (config.showEventTitle && config.eventName) {
    ctx.font = `bold ${Math.round(barH * 0.36)}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
    ctx.fillStyle = '#FFFFFF';
    ctx.textBaseline = 'top';
    ctx.textAlign = 'left';
    ctx.fillText(config.eventName, textX, y + Math.round(barH * 0.18));
  }

  // Guest name
  if (config.showGuestName && config.guestName) {
    ctx.font = `500 ${Math.round(barH * 0.26)}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
    ctx.fillStyle = config.primaryColor || '#A594F9';
    ctx.textBaseline = 'top';
    ctx.textAlign = 'left';
    const guestY = config.showEventTitle && config.eventName ? y + Math.round(barH * 0.56) : y + Math.round(barH * 0.35);
    ctx.fillText(config.guestName, textX, guestY);
  }

  // Date
  if (config.showDate && config.eventDate) {
    ctx.font = `400 ${Math.round(barH * 0.24)}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'right';
    ctx.fillText(config.eventDate, width - 28, y + barH / 2);
  }

  ctx.restore();
}

// ── 2. Bold Frame ───────────────────────────────────────────────────────────
export function drawBoldFrame(ctx, width, height, config, logoImg) {
  const topH = Math.round(height * 0.11);
  const botH = Math.round(height * 0.09);
  const primary = config.primaryColor || '#7F77DD';

  ctx.save();
  // Top Header Banner
  ctx.fillStyle = primary;
  ctx.fillRect(0, 0, width, topH);

  let titleX = width / 2;
  let textAlign = 'center';

  if (config.showLogo && logoImg && logoImg.complete && logoImg.naturalWidth > 0) {
    const logoSize = Math.round(topH * 0.7);
    try {
      ctx.drawImage(logoImg, 24, (topH - logoSize) / 2, logoSize, logoSize);
    } catch (_) {}
  }

  // Event Title
  if (config.showEventTitle && config.eventName) {
    ctx.font = `bold ${Math.round(topH * 0.42)}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
    ctx.fillStyle = '#FFFFFF';
    ctx.textBaseline = 'middle';
    ctx.textAlign = textAlign;
    ctx.fillText(config.eventName, titleX, topH / 2);
  }

  // Date on top right
  if (config.showDate && config.eventDate) {
    ctx.font = `600 ${Math.round(topH * 0.26)}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'right';
    ctx.fillText(config.eventDate, width - 24, topH / 2);
  }

  // Bottom Footer Banner
  ctx.fillStyle = 'rgba(15, 15, 25, 0.9)';
  ctx.fillRect(0, height - botH, width, botH);
  ctx.fillStyle = primary;
  ctx.fillRect(0, height - botH, width, 3);

  // Guest Name
  if (config.showGuestName && config.guestName) {
    ctx.font = `bold ${Math.round(botH * 0.42)}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
    ctx.fillStyle = '#FFFFFF';
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'center';
    ctx.fillText(config.guestName, width / 2, height - botH / 2);
  }

  ctx.restore();
}

// ── 3. Elegant Frame ────────────────────────────────────────────────────────
export function drawElegantFrame(ctx, width, height, config) {
  const gradH = Math.round(height * 0.24);
  const primary = config.primaryColor || '#D4AF37';

  ctx.save();
  // Bottom Luxury Gradient
  const grad = ctx.createLinearGradient(0, height - gradH, 0, height);
  grad.addColorStop(0, 'rgba(10, 10, 15, 0)');
  grad.addColorStop(0.4, 'rgba(10, 10, 15, 0.55)');
  grad.addColorStop(1, 'rgba(10, 10, 15, 0.92)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, height - gradH, width, gradH);

  // Elegant divider line
  ctx.fillStyle = primary;
  ctx.fillRect(36, height - Math.round(gradH * 0.52), width - 72, 2);

  // Event Title (Serif)
  if (config.showEventTitle && config.eventName) {
    ctx.font = `italic 600 ${Math.round(height * 0.045)}px "Playfair Display", Georgia, serif`;
    ctx.fillStyle = '#FFFFFF';
    ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
    ctx.shadowBlur = 6;
    ctx.textBaseline = 'bottom';
    ctx.textAlign = 'center';
    ctx.fillText(config.eventName, width / 2, height - Math.round(gradH * 0.56));
  }

  // Guest Name
  if (config.showGuestName && config.guestName) {
    ctx.font = `italic ${Math.round(height * 0.03)}px "Playfair Display", Georgia, serif`;
    ctx.fillStyle = primary;
    ctx.shadowBlur = 4;
    ctx.textBaseline = 'top';
    ctx.textAlign = 'center';
    ctx.fillText(config.guestName, width / 2, height - Math.round(gradH * 0.48));
  }

  // Date
  if (config.showDate && config.eventDate) {
    ctx.font = `400 13px Georgia, serif`;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.textBaseline = 'bottom';
    ctx.textAlign = 'right';
    ctx.fillText(config.eventDate, width - 40, height - 12);
  }

  ctx.restore();
}

// ── 4. Neon Frame ───────────────────────────────────────────────────────────
export function drawNeonFrame(ctx, width, height, config) {
  const primary = config.primaryColor || '#00F0FF';
  const margin = 16;
  const barH = 75;

  ctx.save();
  // Neon Cyber Outer Border
  ctx.strokeStyle = primary;
  ctx.lineWidth = 3;
  ctx.shadowColor = primary;
  ctx.shadowBlur = 14;
  ctx.strokeRect(margin, margin, width - margin * 2, height - margin * 2);

  // Corner accents
  ctx.lineWidth = 6;
  const cLen = 30;
  // Top-left
  ctx.beginPath(); ctx.moveTo(margin, margin + cLen); ctx.lineTo(margin, margin); ctx.lineTo(margin + cLen, margin); ctx.stroke();
  // Top-right
  ctx.beginPath(); ctx.moveTo(width - margin - cLen, margin); ctx.lineTo(width - margin, margin); ctx.lineTo(width - margin, margin + cLen); ctx.stroke();
  // Bottom-left
  ctx.beginPath(); ctx.moveTo(margin, height - margin - cLen); ctx.lineTo(margin, height - margin); ctx.lineTo(margin + cLen, height - margin); ctx.stroke();
  // Bottom-right
  ctx.beginPath(); ctx.moveTo(width - margin - cLen, height - margin); ctx.lineTo(width - margin, height - margin); ctx.lineTo(width - margin, height - margin - cLen); ctx.stroke();

  // Bottom text box
  ctx.shadowBlur = 0;
  ctx.fillStyle = 'rgba(8, 8, 16, 0.85)';
  ctx.fillRect(margin + 4, height - margin - barH, width - margin * 2 - 8, barH - 4);

  // Glowing title
  ctx.shadowColor = primary;
  ctx.shadowBlur = 10;
  ctx.fillStyle = primary;
  if (config.showEventTitle && config.eventName) {
    ctx.font = `bold 24px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
    ctx.textBaseline = 'top';
    ctx.textAlign = 'left';
    ctx.fillText(config.eventName.toUpperCase(), margin + 20, height - margin - barH + 12);
  }

  // Guest name
  ctx.shadowBlur = 4;
  ctx.fillStyle = '#FFFFFF';
  if (config.showGuestName && config.guestName) {
    ctx.font = `600 17px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
    ctx.textBaseline = 'top';
    ctx.textAlign = 'left';
    ctx.fillText(config.guestName, margin + 20, height - margin - barH + 42);
  }

  // Date
  if (config.showDate && config.eventDate) {
    ctx.font = `400 14px monospace`;
    ctx.fillStyle = primary;
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'right';
    ctx.fillText(config.eventDate, width - margin - 20, height - margin - barH / 2);
  }

  ctx.restore();
}

// ── 5. Classic Frame ────────────────────────────────────────────────────────
export function drawClassicFrame(ctx, width, height, config) {
  const primary = config.primaryColor || '#7F77DD';
  const barH = 50;
  const subH = 34;
  const barW = Math.min(width * 0.75, 560);
  const y = height - barH - subH - 30;

  ctx.save();
  // Slanted top title polygon
  ctx.beginPath();
  ctx.moveTo(0, y);
  ctx.lineTo(barW, y);
  ctx.lineTo(barW - 24, y + barH);
  ctx.lineTo(0, y + barH);
  ctx.closePath();
  ctx.fillStyle = primary;
  ctx.fill();

  // Slanted sub-bar for guest name
  ctx.beginPath();
  ctx.moveTo(0, y + barH);
  ctx.lineTo(barW - 36, y + barH);
  ctx.lineTo(barW - 54, y + barH + subH);
  ctx.lineTo(0, y + barH + subH);
  ctx.closePath();
  ctx.fillStyle = 'rgba(15, 15, 25, 0.9)';
  ctx.fill();

  // Event title
  if (config.showEventTitle && config.eventName) {
    ctx.font = `bold 22px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
    ctx.fillStyle = '#FFFFFF';
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    ctx.fillText(config.eventName.toUpperCase(), 24, y + barH / 2);
  }

  // Guest name
  if (config.showGuestName && config.guestName) {
    ctx.font = `600 16px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
    ctx.fillStyle = '#FFFFFF';
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    ctx.fillText(config.guestName, 24, y + barH + subH / 2);
  }

  ctx.restore();
}

// ── Master Dispatcher ───────────────────────────────────────────────────────
export function drawCanvasFrame(ctx, width, height, config, logoImg) {
  if (!config || config.enabled === false) return;
  const style = config.style || 'minimal';
  switch (style) {
    case 'bold':
      drawBoldFrame(ctx, width, height, config, logoImg);
      break;
    case 'elegant':
      drawElegantFrame(ctx, width, height, config, logoImg);
      break;
    case 'neon':
      drawNeonFrame(ctx, width, height, config, logoImg);
      break;
    case 'classic':
      drawClassicFrame(ctx, width, height, config, logoImg);
      break;
    case 'minimal':
    default:
      drawMinimalFrame(ctx, width, height, config, logoImg);
      break;
  }
}
