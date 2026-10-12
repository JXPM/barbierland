import QRCode from 'qrcode';

// Le QR encode l'URL du billet : un téléphone qui le scanne ouvre /t/<code>,
// l'appli de contrôle en extrait le code.
export const lienBillet = (base, code) => `${base}/t/${encodeURIComponent(code)}`;

const OPTIONS = { errorCorrectionLevel: 'M', margin: 2, color: { dark: '#1B1210', light: '#FFFFFF' } };

export const qrSvg = texte => QRCode.toString(texte, { ...OPTIONS, type: 'svg' });
export const qrPng = (texte, width = 600) => QRCode.toBuffer(texte, { ...OPTIONS, type: 'png', width });
