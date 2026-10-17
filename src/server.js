import { createApp } from './app.js';
import { config } from './config/index.js';

const app = createApp();
app.listen(config.port, config.host, () => {
  console.log(`competitive-cards listening on http://${config.host}:${config.port}`);
});
