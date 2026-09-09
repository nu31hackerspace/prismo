const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  
  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', error => console.log('PAGE ERROR:', error.message));
  
  await page.goto('http://localhost:3000/', { waitUntil: 'networkidle2' });
  await page.goto('http://localhost:3000/docs', { waitUntil: 'networkidle2' });
  
  await browser.close();
})();
