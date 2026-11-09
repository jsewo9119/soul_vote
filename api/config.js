module.exports = (_request, response) => {
  response.setHeader('Cache-Control', 'no-store');
  response.status(200).json({ googleClientId: process.env.GOOGLE_CLIENT_ID || '' });
};
