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
    conn.connect()
        .then(() => {
            // Connection successful

            // Get addresses in the list
            conn.write('/ip/firewall/address-list/print', [
                `?list=${listName}`,
                `?address=${ip}`
            ]).then((data) => {
                var existingEntries = data;
                console.log(JSON.stringify(existingEntries));
                
                    // Add IP if not in the list
                    if (existingEntries.length === 0) {
                        conn.write([
                        '/ip/firewall/address-list/add',
                        `=list=${listName}`,
                        `=address=${ip}`,
                        `=comment=Added on ${new Date().toISOString()}`
                      ]);
                      console.log(`IP ${ip} added to address list.`);
                    } else {
                      console.log(`IP ${ip} already exists in the address list.`);
                    }
                
                    conn.close();
                })
                .catch((err) => {
                    // Oops, got an error
                    console.log(err);
                });
        })
        .catch((err) => {
            // Got an error while trying to connect
            console.log(err);
        });
}



// var mikronodeDevice = new MikroNode(router.host);

// mikronodeDevice.connect()
//       .then(([login])=>{
//         return login(router.user, router.pass);
//       })
//       .then(function(conn) {
 
//         var chan=conn.openChannel("addresses"); // open a named channel
//         var chan2=conn.openChannel("firewall_connections",true); // open a named channel, turn on "closeOnDone"
 
//         chan.write('/ip/address/print');
 
//         chan.on('done',function(data) {
 
//              // data is all of the sentences in an array.
//              data.forEach(function(item) {
//                 console.log('Interface/IP: '+item.data.interface+"/"+item.data.address);
//              });
 
//              chan.close(); // close the channel. It is not autoclosed by default.
//              conn.close(); // when closing connection, the socket is closed and program ends.
 
//         });
 
//         chan.write('/ip/firewall/print');
 
//         chan.done.subscribe(function(data){
 
//              // data is all of the sentences in an array.
//              data.forEach(function(item) {
//                 var data = MikroNode.resultsToObj(item.data); // convert array of field items to object.
//                 console.log('Interface/IP: '+data.interface+"/"+data.address);
//              });
 
//         });
 
//     });

// Function to add IP to MikroTik address list
// async function addIpToAddressListOLD(ip, listName = list) {
//     mikronodeDevice.connect()
//         .then(([login]) => {
//             return login(router.user, router.pass);
//         })
//         .then(function (conn) {
//   try {
//     const channel = connection.openChannel();

//     // Check if IP already exists in the list
//     const existingEntries = channel.writeAndRead([
//       '/ip/firewall/address-list/print',
//       `?list=${listName}`,
//       `?address=${ip}`
//     ]);

//     if (existingEntries.length === 0) {
//       // Add IP if not in the list
//       channel.write([
//         '/ip/firewall/address-list/add',
//         `=list=${listName}`,
//         `=address=${ip}`,
//         `=comment=Added on ${new Date().toISOString()}`
//       ]);
//       console.log(`IP ${ip} added to address list.`);
//     } else {
//       console.log(`IP ${ip} already exists in the address list.`);
//     }

//     channel.close();
//   } catch (err) {
//     console.error(`Error interacting with MikroTik: ${err.message}`);
//   } finally {
//     connection.close();
//   }
            
//         });

// //   const connection = await MikroNode.connect(router.host, router.user, router.pass);
  

// }

// Function to remove old IPs from the address list
// async function removeOldIps(listName = list, maxAgeHours = expireHours) {
//   const connection = MikroNode.connect(router.host, router.user, router.pass);
//   try {
//     await connection.connect();
//     const channel = connection.openChannel();

//     const now = new Date();
//     const maxAgeMs = maxAgeHours * 60 * 60 * 1000;

//     // Get all entries in the address list
//     const entries = await channel.writeAndRead([
//       '/ip/firewall/address-list/print',
//       `?list=${listName}`
//     ]);

//     for (const entry of entries) {
//       const commentDate = entry.comment?.match(/Added on (.+)/)?.[1];
//       if (commentDate) {
//         const entryDate = new Date(commentDate);
//         if (now - entryDate > maxAgeMs) {
//           // Remove old entries
//           await channel.write([
//             '/ip/firewall/address-list/remove',
//             `=.id=${entry['.id']}`
//           ]);
//           console.log(`Removed IP ${entry.address} from address list.`);
//         }
//       }
//     }

//     channel.close();
//   } catch (err) {
//     console.error(`Error cleaning up old IPs: ${err.message}`);
//   } finally {
//     connection.close();
//   }
// }

// Route to handle incoming POST requests
app.post('/add-ip', async (req, res) => {
  const { ip } = req.body;

  if (!ip) {
    return res.status(400).send('IP address is required.');
  }

    try {
        console.log("IPPPP: " + JSON.stringify(ip));
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
