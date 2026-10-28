# SNMP Monitoring Lab Report

**Author:** Shuaib
**Date:** 2026-10-27
**Tooling:** EVE-NG (Cisco IOSv routers), Paessler SNMP Tester 24.4.102.648 on Windows (DESKTOP-PFP2ESM)

---

## 1. Objectives

1. Build a routed lab topology with EIGRP, redistribution, and OSPF.
2. Enable SNMP (v2c and v3) on the lab routers so a management station can poll them.
3. Validate SNMP polling end-to-end with Paessler SNMP Tester: uptime, 32-bit counters, 64-bit counters, and a full interface scan.
4. Analyze the raw SNMP request/response log and interpret OIDs, datatypes, and exceptions.

---

## 2. Topology

![Lab Topology](Topology.png)

The lab runs in EVE-NG (`192.168.1.101/legacy`) with three IOSv routers:

| Node | Role | Links |
|------|------|-------|
| **R2** | EIGRP 100 source | `e0/0` → VPC, `e0/2` → R1 |
| **R1** | ASR redistribute (EIGRP ↔ OSPF boundary) | `e0/2` → R2, `e0/0` → Branch |
| **Branch** | OSPF 100 verifier | `e0/0` → R1, `e0/1` → VPC-copy, `e0/2` → Net (cloud) |

The Windows monitor (SNMP Tester) polls the lab over the LAN.

---

## 3. Layer 3 Addressing

![R1 interfaces](ip%20configurations/R1.png)
![R2 interfaces](ip%20configurations/R2_ips.png)
![Branch interfaces](ip%20configurations/Branch.png)
![Windows monitor](ip%20configurations/windows.png)

| Node | Interface | IP Address | Status |
|------|-----------|------------|--------|
| **R1** | Ethernet0/0 | 203.0.113.6 | up/up |
| | Ethernet0/1 | 203.0.113.13 | up/up |
| | Loopback0 | 3.3.3.3 | up/up |
| **R2** | Ethernet0/0 | 203.0.113.14 | up/up |
| | Ethernet0/1 | 203.0.113.10 | up/up |
| | Loopback0 | 4.4.4.4 | up/up |
| **Branch** | Ethernet0/0 | 203.0.113.5 | up/up |
| | Ethernet0/1 | 203.0.113.1 | up/up |
| | Ethernet0/2 | 192.168.1.88 | up/up (manual, LAN) |
| | Loopback0 | 1.1.1.1 | up/up |
| **Windows monitor** | Wi-Fi | 192.168.1.89/24 | gw 192.168.1.1 |

The polling host is the Windows machine at `192.168.1.89`; Branch's `e0/2` bridges the lab onto that LAN, which is why `203.0.113.6` (R1) is reachable from the tester.

---

## 4. Routing Configuration (Branch)

![OSPF config](ospftroubleshooting/OSPF.png)

```
router ospf 1
 router-id 1.1.1.1
 network 1.1.1.1 0.0.0.0 area 0
 network 10.10.10.0 0.0.0.255 area 0
 network 192.168.1.0 0.0.0.255 area 0
 network 203.0.113.0 0.0.0.3 area 0
 network 203.0.113.4 0.0.0.3 area 0
 distribute-list prefix PROTECT_TRANSIT in
router ospf 100
 router-id 5.5.5.5
 network 203.0.113.4 0.0.0.3 area 0
```

Branch runs two OSPF processes and filters transit prefixes, verifying routes redistributed from the EIGRP side through R1.

---

## 5. SNMP Configuration

### 5.1 Community + trap host (R1, R2, Branch)

All three routers run the same baseline SNMP config:

![R1 SNMP config](snmp%20configuration/R1.png)
![R2 SNMP config](snmp%20configuration/R2.png)
![Branch SNMP config](snmp%20configuration/Screenshot%202026-10-27%20224952.png)

```
snmp-server community SHUAIB_SNMP_LAB RO
snmp-server host 192.168.1.89 version 2c SHUAIB_SNMP_LAB
```

- **Read-only** community `SHUAIB_SNMP_LAB` — pollers can query but never modify.
- **Trap destination** `192.168.1.89` (the Windows monitor) over SNMPv2c.

### 5.2 Trap enablement (R2)

![R2 enabled traps](snmp%20configuration/R2_1.png)

R2 additionally enables a broad trap set so the monitor receives unsolicited notifications:

```
snmp-server enable traps snmp authentication linkdown linkup coldstart warmstart
snmp-server enable traps vrrp
snmp-server enable traps flowmon
snmp-server enable traps dsl
snmp-server enable traps tty
snmp-server enable traps eigrp
snmp-server enable traps ospf state-change
snmp-server enable traps ospf errors
snmp-server enable traps ospf retransmit
snmp-server enable traps ospf lsa
snmp-server enable traps ospf cisco-specific state-change nssa-trans-change
snmp-server enable traps ospf cisco-specific state-change shamlink interface
snmp-server enable traps ospf cisco-specific state-change shamlink neighbor
snmp-server enable traps ospf cisco-specific errors
snmp-server enable traps ospf cisco-specific retransmit
snmp-server enable traps ospf cisco-specific lsa
snmp-server enable traps xgcp
snmp-server enable traps isdn call-information
snmp-server enable traps isdn layer2
snmp-server enable traps isdn chan-not-avail
snmp-server enable traps isdn ietf
```

This covers link up/down, authentication failures, routing-protocol events (EIGRP/OSPF), and ISDN/other hardware events.

---

## 6. SNMP Testing (Paessler SNMP Tester)

All tests target **R1 at `203.0.113.6:161`**.

### 6.1 Test 1 — SNMPv3 device uptime (authenticated + encrypted)

![v3 uptime test](snmp%20configuration/Screenshot%202026-10-27%20234202.png)

**Settings:** SNMP v3, user `SHUAIB_SNMP_LAB`, auth **MD5**, encryption **DES**. Request type: *Read Device Uptime*.

**Result:**

| Step | Outcome |
|------|---------|
| `SNMP v3` handshake | OK (4 ms) |
| `sysUpTimeInstance` | `2329999` timeticks = **6 h 28 m** uptime |
| `sysUpTime.0` (OID 1.3.6.1.2.1.1.3.0, second probe) | `SNMP_EXCEPTION_NOSUCHOBJECT` |
| Overall | Done |

**Interpretation:** SNMPv3 authentication and encryption work — the agent returned a real, decrypted value. The later `noSuchObject` on the classic `sysUpTime.0` OID means the IOSv agent doesn't populate that exact instance for the second query style (the tester's first probe already read it successfully as `sysUpTimeInstance`), not a connectivity failure.

### 6.2 Test 2 — 32-bit traffic counters (v2c)

![32-bit counter test](snmp%20configuration/Screenshot%202026-10-27%20234634.png)

**Settings:** SNMP v2c, community `SHUAIB_SNMP_LAB`, request type: *32-bit Traffic Counter*.

**Result:** `In: 885038`, `Out: 1058793` (`ASN_COUNTER`) — **Ok**.

These are the classic `ifInOctets` (1.3.6.1.2.1.2.2.1.10) / `ifOutOctets` (1.3.6.1.2.1.2.2.1.16) byte counters: cumulative totals since counter reset, not rates. A monitor computes bandwidth by polling twice and dividing the delta by the interval. 32-bit counters wrap at ~4.29 GB.

### 6.3 Test 3 — 64-bit traffic counters (v2c)

![64-bit counter test](snmp%20configuration/Screenshot%202026-10-27%20235052.png)

**Result:** `In: 889056`, `Out: 1070833` (`ASN_COUNTER64`) — **Ok**.

The device supports the IF-MIB 64-bit counters (`ifHCInOctets` / `ifHCOutOctets`, base OID 1.3.6.1.2.1.31.1.1.1.6 / .10), which remove the wrap-around problem for high-traffic links. Note the values keep growing between the 32-bit and 64-bit tests — consistent counters on a live interface.

---

## 7. Log Analysis — Interface Scan (`Testing_R1_e0_0.txt`)

Full log: [`Analyze_Log_Files/Testing_R1_e0_0.txt`](../../Documents/Analyze_Log_Files/Testing_R1_e0_0.txt)

The tester performed a v2c interface scan of R1 (community `SHUAIB_SNMP_LAB`) by walking the standard MIB-II and IF-MIB tables:

| OID | Meaning |
|-----|---------|
| `1.3.6.1.2.1.1.3.0` | sysUpTime → `2387192` timeticks (~6.6 h) |
| `1.3.6.1.2.1.2.1.0` | ifNumber → **8** interfaces |
| `1.3.6.1.2.1.31.1.1.1.1.x` | ifName (walked with GETNEXT/GETBULK) |
| `1.3.6.1.2.1.31.1.1.1.6.x` / `.10.x` | 64-bit in/out octets |
| `1.3.6.1.2.1.2.2.1.8.x` | ifOperStatus (1 = up, 2 = down) |
| `1.3.6.1.2.1.31.1.1.1.18.x` | ifAlias (interface description) |
| `1.3.6.1.2.1.2.2.1.3.x` | ifType (6 = ethernetCsmacd) |

### Interfaces discovered on R1

| # | ifName | ifAlias | Status | Counters |
|---|--------|---------|--------|----------|
| 1 | Et0/0 | **Q1 R1 to Branch** | Connected, 10 Mbit/s | 64-bit, in=902496 out=1078637 |
| 2 | Et0/1 | **Q1 R1 to R2** | Connected, 10 Mbit/s | 64-bit, in=1222212 out=1173744 |
| 3 | Ethernet0/2 | — | Not connected | 64-bit, in=0 out=0 |
| 4 | Ethernet0/3 | — | Not connected | 64-bit, in=0 out=0 |
| 5 | VoIP-Null0 | — | Connected | 64-bit, in=0 out=0 |
| 6 | Null0 | — | Connected | 32-bit only (64-bit → `NOSUCHINSTANCE`), in=0 out=0 |
| 7 | Loopback0 | — | Connected, 8 Gbit/s | 64-bit, in=0 out=0 |
| 8 | Loopback101 | — | Connected, 8 Gbit/s | 64-bit, in=0 out=836 |

### Key observations

1. **Every request returned `Status=0`** — zero timeouts or errors across ~40 GET/GETNEXT/GETBULK operations. The v2c polling channel is clean.
2. **Interface aliases came back configured** ("Q1 R1 to Branch", "Q1 R1 to R2"), proving `description` statements on interfaces surface through SNMP `ifAlias` — useful for mapping ports to topology in a NMS.
3. **The only exceptions were expected:** Null0 has no 64-bit counters (`SNMP_EXCEPTION_NOSUCHINSTANCE`), so the tester correctly fell back to 32-bit counters (`inout32=3`) for that virtual interface.
4. **Counter values are consistent across tests** — the interface scan (~11:51 PM) shows Et0/0 in/out slightly higher than the standalone counter tests minutes earlier, as live traffic accrued.
5. GETBULK (v2c feature) was used to walk the ifName table efficiently — impossible in v1, one of v2c's practical advantages.

---

## 8. Conclusion

| Goal | Status |
|------|--------|
| SNMP v2c read-only polling from management station | ✅ Working |
| SNMP v3 with MD5 auth + DES privacy | ✅ Working (authenticated, encrypted read) |
| Trap configuration toward `192.168.1.89` | ✅ Configured |
| 32-bit and 64-bit interface counters | ✅ Both available and increasing |
| Full interface discovery via ifTable/ifXTable walk | ✅ 8/8 interfaces enumerated |

The lab demonstrates the complete SNMP monitoring chain: agent configuration on Cisco IOS (community, trap host, traps), reachability from a management station, and interpretation of raw SNMP traffic — OIDs, ASN datatypes (`TIMETICKS`, `COUNTER`, `COUNTER64`, `OCTET STR`), exceptions (`NOSUCHOBJECT`, `NOSUCHINSTANCE`), and the difference between cumulative counters and computed rates.

**Possible next steps:** verify traps arriving at a collector (e.g. shut/no shut an interface on R2), restrict SNMP with an ACL, and compare MD5/SHA + DES/AES v3 security levels.
