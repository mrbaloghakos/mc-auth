const express = require('express');
const bodyParser = require('body-parser');
const { MikroNode } = require('mikronode');

const app = express();
const port = 3000;
const list = 'mc-auth';
const expireHours = 5;

// Middleware to parse JSON request bodies
app.use(bodyParser.json());

// MikroTik connection settings
const router = {
  host: '192.168.1.1', // Replace with your router's IP
  user: 'mc-auth',        // Replace with your router's username
  pass: '`279T|VhIr*e'      // Replace with your router's password
};

// Function to add IP to MikroTik address list
async function addIpToAddressList(ip, listName = list) {
  const connection = MikroNode.getConnection(router.host, router.user, router.pass);
  try {
    await connection.connect();
    const channel = connection.openChannel();

    // Check if IP already exists in the list
    const existingEntries = await channel.writeAndRead([
      '/ip/firewall/address-list/print',
      `?list=${listName}`,
      `?address=${ip}`
    ]);

    if (existingEntries.length === 0) {
      // Add IP if not in the list
      await channel.write([
        '/ip/firewall/address-list/add',
        `=list=${listName}`,
        `=address=${ip}`,
        `=comment=Added on ${new Date().toISOString()}`
      ]);
      console.log(`IP ${ip} added to address list.`);
    } else {
      console.log(`IP ${ip} already exists in the address list.`);
    }

    channel.close();
  } catch (err) {
    console.error(`Error interacting with MikroTik: ${err.message}`);
  } finally {
    connection.close();
  }
}

// Function to remove old IPs from the address list
async function removeOldIps(listName = list, maxAgeHours = expireHours) {
  const connection = MikroNode.getConnection(router.host, router.user, router.pass);
  try {
    await connection.connect();
    const channel = connection.openChannel();

    const now = new Date();
    const maxAgeMs = maxAgeHours * 60 * 60 * 1000;

    // Get all entries in the address list
    const entries = await channel.writeAndRead([
      '/ip/firewall/address-list/print',
      `?list=${listName}`
    ]);

    for (const entry of entries) {
      const commentDate = entry.comment?.match(/Added on (.+)/)?.[1];
      if (commentDate) {
        const entryDate = new Date(commentDate);
        if (now - entryDate > maxAgeMs) {
          // Remove old entries
          await channel.write([
            '/ip/firewall/address-list/remove',
            `=.id=${entry['.id']}`
          ]);
          console.log(`Removed IP ${entry.address} from address list.`);
        }
      }
    }

    channel.close();
  } catch (err) {
    console.error(`Error cleaning up old IPs: ${err.message}`);
  } finally {
    connection.close();
  }
}

// Route to handle incoming POST requests
app.post('/add-ip', async (req, res) => {
  const { ip } = req.body;

  if (!ip) {
    return res.status(400).send('IP address is required.');
  }

  try {
    await addIpToAddressList(ip);
    res.status(200).send(`IP ${ip} processed.`);
  } catch (err) {
    console.error(err);
    res.status(500).send('An error occurred while processing the request.');
  }
});

// Periodically clean up old IPs
setInterval(() => {
  removeOldIps().catch(err => console.error(`Cleanup failed: ${err.message}`));
}, 60 * 60 * 1000); // Run cleanup every hour

// Start the server
app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});
