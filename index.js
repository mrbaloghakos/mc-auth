const express = require('express');
const bodyParser = require('body-parser');
const RosApi = require('node-routeros').RouterOSAPI;

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

const conn = new RosApi({
    host: router.host,
    user: router.user,
    password: router.pass,
});

async function addIpToAddressList(ip, listName = list) {
    conn.connect().then(async () => {
        await conn.write('/ip/firewall/address-list/print', [
            `?list=${listName}`,
            `?address=${ip}`
        ]).then(async (data) => {
            var existingEntries = data;
            if (existingEntries.length === 0) {
                await conn.write([
                    '/ip/firewall/address-list/add',
                    `=list=${listName}`,
                    `=address=${ip}`,
                    `=comment=Added on ${new Date().toISOString()}`
                ]).then(() => {
                    console.log(`IP ${ip} added to address list.`);
                }).catch((err) => {
                    console.log("Adding error")
                    console.log(err.message);
                });
            } else {
                console.log(`IP ${ip} already exists in the address list.`);
            }
            await conn.close();
        })
            .catch((err) => {
                console.log("Command error");
                console.log(err);
            });
    }).catch((err) => {
        console.log("Couldn't connect to the router");
        console.log(err);
    });
}

// Function to remove old IPs from the address list
async function removeOldIps(listName = list, maxAgeHours = expireHours) {
    conn.connect().then(async () => {
        await conn.write('/ip/firewall/address-list/print', [
            `?list=${listName}`
        ]).then(async (data) => {
            var existingEntries = data;
            for (const entry of existingEntries) {
                const commentDate = entry.comment?.match(/Added on (.+)/)?.[1];
                if (commentDate) {
                    const entryDate = new Date(commentDate);
                    const now = new Date();
                    const maxAgeMs = maxAgeHours * 60 * 60 * 1000;
                    if (now - entryDate > maxAgeMs) {
                        await conn.write([
                            '/ip/firewall/address-list/remove',
                            `=.id=${entry['.id']}`
                        ]);
                        console.log(`Removed IP ${entry.address} from address list.`);
                    }
                }
            }
            await conn.close();
        })
            .catch((err) => {
                console.log("Command error");
                console.log(err);
            });
    }).catch((err) => {
        console.log("Couldn't connect to the router");
        console.log(err);
    });
}

// Route to handle incoming POST requests
app.post('/add-ip', async (req, res) => {
    const { ip } = req.body;

    if (!ip) {
        return res.status(400).send('IP address is required.\n');
    }
    try {
        // console.log("IPPPP: " + JSON.stringify(ip));
        await addIpToAddressList(ip);
        res.status(200).send(`IP ${ip} processed.\n`);
    } catch (err) {
        console.error(err);
        res.status(500).send('An error occurred while processing the request.\n');
    }
});
// removeOldIps();

// Periodically clean up old IPs
setInterval(() => {
    removeOldIps().catch(err => console.error(`Cleanup failed: ${err.message}`));
}, 60 * 60 * 1000); // Run cleanup every hour

// Start the server
app.listen(port, () => {
    console.log(`Server listening on port ${port}`);
});
