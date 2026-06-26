# ARP, Ping, Encapsulation, and How Routers Interpret Raw Frames

This lab documents a real physical networking exercise built to strengthen first-principles understanding of how devices communicate on an Ethernet LAN. The objective was not merely to make `ping` work, but to understand **exactly what happens** when a device sends a packet, how that packet is represented in raw bytes, how a switch forwards it, and how a router interprets it.

The key concept that locked this in was simple:

> The wire carries bits. Those bits form bytes. Those bytes form structured headers. Wireshark decodes those structured bytes into human-readable fields.

That is the bridge between “raw packet data” and what network devices actually process.

---

## 1. Lab Topology

The lab is a single management subnet used to observe same-subnet Layer 2 and Layer 3 behavior.

- **Management subnet:** `192.168.10.0/24`
- **PC1:** `192.168.10.20`
- **R1:** `192.168.10.1`
- **R2:** `192.168.10.2`
- **R3:** `192.168.10.3`
- **FW1:** `192.168.10.4`
- **SW1:** `192.168.10.10`

![Lab topology](arp-ping-lab/images/topology.png)

This topology was ideal for understanding the following:

- how a host determines whether a destination is local or remote
- how ARP resolves an IP address to a MAC address
- how an Ethernet broadcast differs from a Layer 3 target IP
- how a switch forwards based on MAC addresses only
- how a router decapsulates the Ethernet frame and reads the IP packet inside

---

## 2. PC Interface State and ARP Cache

Before capturing traffic, the PC interface was verified with `ipconfig`.

![ipconfig output](arp-ping-lab/images/ipconfig.png)

This confirmed that the lab NIC was configured as:

- **IPv4 address:** `192.168.10.20`
- **Subnet mask:** `255.255.255.0`

The ARP cache was then checked with `arp -a`.

![ARP cache output](arp-ping-lab/images/arp-cache.png)

### Initial observation
The `192.168.10.20` interface initially had only static broadcast and multicast mappings, not dynamic entries for devices such as R1 or SW1. That meant the PC did **not yet know** the MAC address for those lab devices.

That is exactly why ARP exists.

---

## 3. What ARP Actually Does

ARP exists to answer this question:

> “I know the destination IP. What is the destination MAC?”

On Ethernet, a host cannot send a unicast frame until it knows the Layer 2 destination MAC address.

For a same-subnet destination, the PC does **not** send to a default gateway first. It ARPs for the destination host directly.

### In this lab
PC1 wanted to reach `192.168.10.1`.

PC1 checked:

- Source IP: `192.168.10.20`
- Destination IP: `192.168.10.1`
- Mask: `/24`

Because both addresses are in `192.168.10.0/24`, the destination is **local**. So PC1 had to learn **R1’s MAC address directly**.

---

## 4. ARP Request vs ARP Reply

### ARP Request
The first frame seen in Wireshark was an ARP Request from PC1.

![ARP request in Wireshark](arp-ping-lab/images/wireshark-arp-request.png)

Wireshark decoded the request as:

- **Sender MAC:** `00:05:1b:de:60:2f`
- **Sender IP:** `192.168.10.20`
- **Target MAC:** `00:00:00:00:00:00`
- **Target IP:** `192.168.10.1`
- **Ethernet destination MAC:** `ff:ff:ff:ff:ff:ff`

### Why the destination MAC is broadcast
This is the critical distinction:

- In the **Ethernet II header**, the destination is the **broadcast MAC** because PC1 does not yet know which device owns `192.168.10.1`.
- In the **ARP payload**, the target is a **specific IP address**, `192.168.10.1`.

So the ARP Request is a **specific question** carried inside a **broadcast Ethernet frame**.

In plain language:

> “Who has 192.168.10.1? Tell 192.168.10.20.”

### ARP Reply
R1 responded with an ARP Reply.

![ARP reply in Wireshark](arp-ping-lab/images/wireshark-arp-reply.png)

Wireshark decoded the reply as:

- **Sender MAC:** `00:ea:bd:94:2d:50`
- **Sender IP:** `192.168.10.1`
- **Target MAC:** `00:05:1b:de:60:2f`
- **Target IP:** `192.168.10.20`

Now the frame is no longer broadcast. The reply is **unicast** back to the original requester.

In plain language:

> “192.168.10.1 is at 00:ea:bd:94:2d:50.”

### Difference summary
| Field | ARP Request | ARP Reply |
|---|---|---|
| Opcode | 1 | 2 |
| Ethernet destination | Broadcast | Unicast |
| Purpose | Ask for unknown MAC | Provide known MAC |
| Target MAC in ARP payload | `00:00:00:00:00:00` | Requester’s MAC |

---

## 5. Ethernet II vs ARP Payload: The Key Understanding

A major breakthrough in this lab was understanding why Wireshark shows two different destination concepts in the same packet.

### Ethernet II header
The Ethernet II header contains Layer 2 forwarding information:

- destination MAC
- source MAC
- EtherType

For the ARP Request, the Ethernet II destination was:

- `ff:ff:ff:ff:ff:ff`

That is a Layer 2 broadcast MAC.

### ARP payload
The ARP payload contains the IP-level identity question:

- sender MAC
- sender IP
- target MAC
- target IP

For the same ARP Request, the ARP target IP was:

- `192.168.10.1`

### Why this matters
This shows that:

- **Layer 2 decides local delivery on the LAN using MAC addresses**
- **ARP bridges the gap between Layer 3 IP addresses and Layer 2 MAC addresses**

The frame is broadcast at Layer 2 because the MAC is unknown, but the IP being asked about is very specific.

---

## 6. Raw Packet Data and How Routers Interpret It

Another major concept from this lab was understanding that the devices do **not** read the English text shown by Wireshark.

They receive the actual frame as raw bits and bytes.

Wireshark simply translates those bytes into human-readable labels.

### Example: ARP Request raw bytes
A captured ARP Request looked like this in the hex pane:

```text
ff ff ff ff ff ff 00 05 1b de 60 2f 08 06
00 01 08 00 06 04 00 01 00 05 1b de 60 2f
c0 a8 0a 14 00 00 00 00 00 00 c0 a8 0a 01
```

This is not English text. It is raw frame data shown in hexadecimal.

Wireshark knows, based on protocol format, that these byte positions mean:

- bytes 0–5 = destination MAC
- bytes 6–11 = source MAC
- bytes 12–13 = EtherType
- following fields = ARP header and payload

That is how the packet is “translated into English.”

### How a router “reads a packet”
A router performs a layered interpretation:

1. **Receives the Ethernet frame**
2. **Checks the destination MAC** to determine whether the frame is meant for its interface
3. **Decapsulates Layer 2** by removing the Ethernet header
4. **Reads the Layer 3 IP header**
5. **Uses the destination IP** to consult the routing table
6. **Decrements TTL**
7. **Re-encapsulates** the packet with a new Layer 2 header for the next hop

This means the router is not reading “words.” It is reading fields defined by protocol format.

---

## 7. Encapsulation and Decapsulation Through the OSI Model

This lab also made encapsulation/decapsulation much more concrete.

### When PC1 sends a ping
The packet is built downward through the stack.

#### Layer 3 / ICMP construction
`ping` uses **ICMP**, not TCP. The OS creates:

- ICMP Type 8 = Echo Request
- ICMP Code 0
- Identifier
- Sequence Number
- payload data

#### Layer 3 / IP header
Then the IP layer adds:

- source IP = `192.168.10.20`
- destination IP = `192.168.10.1`
- protocol field = `1` for ICMP
- TTL and other IP header fields

#### ARP intermission
Before Ethernet encapsulation can complete, the sender must know the destination MAC.

Because the target is local and not yet in the ARP cache, PC1 pauses and performs ARP resolution.

#### Layer 2 / Ethernet header
Once ARP completes, PC1 adds:

- source MAC = PC1 NIC MAC
- destination MAC = R1 MAC
- EtherType = `0x0800` for IPv4

#### Layer 1
The frame is converted into bits and transmitted.

### Final nested structure
```text
[Ethernet Header [IP Header [ICMP Header [Data]]]]
```

### Decapsulation
On receive, the process is reversed:

1. NIC accepts the frame
2. Ethernet header is examined
3. Layer 2 is stripped
4. IP header is examined
5. Protocol field indicates ICMP
6. ICMP header is examined
7. If Type 8 / Code 0, the host knows it is an Echo Request

---

## 8. Why Ping Uses ICMP Instead of TCP

A useful conceptual clarification from this exercise was understanding why `ping` does not use TCP.

### Ping uses ICMP because:

- it is a simple reachability and diagnostic tool
- it does not need a transport-layer session
- it does not need source/destination ports
- it should work even when higher-level application services are not involved

### TCP would be unnecessary overhead
TCP would require connection state and additional logic such as:

- source port
- destination port
- sequence tracking
- acknowledgments
- handshake behavior

`ping` is intentionally lighter.

Instead, the receiver uses:

- **IP protocol field = 1** to identify ICMP
- **ICMP Type 8, Code 0** to identify Echo Request
- **ICMP Type 0, Code 0** to identify Echo Reply

This is how a device knows that the received packet is a ping.

---

## 9. Switch Behavior vs Router Behavior

This lab reinforced the difference between what a switch does and what a router does.

### Switch
A Layer 2 switch primarily cares about:

- destination MAC
- source MAC learning
- MAC-to-port forwarding
- broadcast flooding within a VLAN

A switch does **not** need to read IP headers in order to forward normal Ethernet traffic.

For the ARP Request, the switch simply saw a broadcast MAC and flooded the frame out all ports in the VLAN except the ingress port.

### Router
A router cares about:

- whether the Layer 2 frame is meant for its interface
- the destination IP in the IP header
- routing table lookup
- next-hop forwarding

The router decapsulates Layer 2 and then makes a Layer 3 forwarding decision.

### Very important distinction
- **ARP table** = IP-to-MAC
- **MAC table / CAM table** = MAC-to-port
- **Routing table** = network/prefix-to-next-hop or exit interface

These are not interchangeable.

---

## 10. Can a Switch Send an ARP Request?

Yes, but only when the switch is acting like a host or Layer 3 device for its **own** traffic.

Examples:

- management IP traffic
- SSH from the switch
- ping initiated from the switch
- SNMP/syslog/SCP/TFTP initiated by the switch
- inter-VLAN routing on a Layer 3 switch

But when forwarding someone else’s ARP Request, the switch is not generating a new ARP message. It is simply flooding the existing frame because the destination MAC is broadcast.

That distinction is critical.

---

## 11. How This Generalizes to Any Packet

The ARP + ping lab is not just about ping. It generalizes to all packet delivery.

### General rule
Any network communication follows the same broad pattern:

1. The sender determines the destination IP
2. The sender decides whether the destination is local or remote
3. If local, it resolves the destination host MAC with ARP
4. If remote, it resolves the default gateway MAC with ARP
5. The sender encapsulates the Layer 3 payload inside a Layer 2 frame
6. Intermediate Layer 2 devices forward based on MAC addresses
7. Routers decapsulate Layer 2, read Layer 3, make routing decisions, then re-encapsulate
8. The destination host decapsulates upward to the relevant upper-layer protocol

The only thing that changes is the Layer 4 or application payload:

- ICMP for ping
- TCP for web/SSH
- UDP for DNS, VoIP, etc.

The encapsulation logic remains the same.

---

## 12. Practical Takeaways From the Lab

### What was learned
- The Ethernet destination in an ARP Request is broadcast MAC, not broadcast IP.
- The ARP payload contains the specific target IP being resolved.
- Devices process structured bytes, not English text.
- Wireshark translates raw bytes into readable field interpretations.
- A switch forwards based on MAC addresses and does not need to understand IP for normal L2 forwarding.
- A router decapsulates the Ethernet frame and interprets the IP packet inside.
- `ping` uses ICMP, not TCP, because it is a network-layer diagnostic message rather than an application session.
- ARP resolution is the prerequisite that enables same-subnet unicast communication.

### Strong mental model
A clean mental model that came out of the lab is:

> Bits become bytes. Bytes become headers. Headers define structure. Devices read structure. Wireshark explains structure.

That model removes much of the “magic” from networking.

---

## 13. Conclusion

This lab took a real packet capture and used it to connect several foundational ideas:

- ARP request vs ARP reply
- Ethernet broadcast vs specific IP target
- OSI model encapsulation and decapsulation
- switch forwarding vs router interpretation
- raw bytes vs decoded protocol fields
- why ping works and how that behavior extends to other packets

The most important result was not merely observing a successful ping. It was understanding how the packet was built, what the raw data meant, how the switch handled it, and how the router knew how to interpret it.

That is the beginning of real packet-level networking intuition.
