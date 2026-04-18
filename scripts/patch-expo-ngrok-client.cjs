/**
 * @expo/ngrok/src/client.js suppose toujours error.response.body (API got).
 * Sur erreurs réseau / session ngrok, response peut être absent → TypeError: ... 'body'.
 * Patch idempotent (réappliqué après chaque npm install via postinstall).
 */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const target = path.join(root, 'node_modules', '@expo', 'ngrok', 'src', 'client.js');

if (!fs.existsSync(target)) {
  console.warn('[patch-expo-ngrok-client] Absent (npm install d’abord) :', target);
  process.exit(0);
}

let s = fs.readFileSync(target, 'utf8');
const marker = 'patch-expo-ngrok-client: garde-fou response/body';

if (s.includes(marker)) {
  process.exit(0);
}

const fromRequest = `    } catch (error) {
      let clientError;
      try {
        const response = JSON.parse(error.response.body);
        clientError = new NgrokClientError(
          response.msg,
          error.response,
          response
        );
      } catch (e) {
        clientError = new NgrokClientError(
          error.response.body,
          error.response,
          error.response.body
        );
      }
      throw clientError;
    }`;

const toRequest = `    } catch (error) {
      // ${marker}
      if (!error.response || error.response.body === undefined || error.response.body === null) {
        throw error;
      }
      let clientError;
      try {
        const response = JSON.parse(error.response.body);
        clientError = new NgrokClientError(
          response.msg,
          error.response,
          response
        );
      } catch (e) {
        const raw = error.response.body;
        clientError = new NgrokClientError(
          typeof raw === 'string' ? raw : (error.message || 'Ngrok error'),
          error.response,
          raw
        );
      }
      throw clientError;
    }`;

const fromBoolean = `    } catch (error) {
      const response = JSON.parse(error.response.body);
      throw new NgrokClientError(response.msg, error.response, response);
    }`;

const toBoolean = `    } catch (error) {
      // ${marker} (booleanRequest)
      if (!error.response || error.response.body === undefined || error.response.body === null) {
        throw error;
      }
      const response = JSON.parse(error.response.body);
      throw new NgrokClientError(response.msg, error.response, response);
    }`;

if (!s.includes(fromRequest)) {
  console.warn('[patch-expo-ngrok-client] Pattern request() changé — patch non appliqué :', target);
  process.exit(0);
}
if (!s.includes(fromBoolean)) {
  console.warn('[patch-expo-ngrok-client] Pattern booleanRequest() changé — patch non appliqué :', target);
  process.exit(0);
}

s = s.replace(fromRequest, toRequest).replace(fromBoolean, toBoolean);
fs.writeFileSync(target, s);
console.log('[patch-expo-ngrok-client] Garde-fou error.response.body appliqué —', target);
