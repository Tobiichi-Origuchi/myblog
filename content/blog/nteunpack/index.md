+++
authors = ["Origuchi"]
title = "NTE ResList Unpack"
description = "A record of my entire process of unpacking NTE's reslist."
date = 2026-04-21
[taxonomies]
tags = ["Game", "Reverse engineering"]
+++

> [!NOTE]
> This page was translated with the assistance of Gemini; the [Chinese version](https://blog.origuchi.uk/zh-Hans/blog/nteunpack/) shall prevail.

## Foreword

This is my first attempt at reverse engineering, and it was completed with the support of Gemini. This article documents the process to prevent me from forgetting it later.

## Getting Started

[Neverness to Everness](https://en.wikipedia.org/wiki/Neverness_to_Everness), hereafter referred to as NTE, will start its open beta on the CN server on April 23, and on the Global server on April 29.

Today, April 21st, the CN server opened for pre-download, so naturally, I downloaded it right away.

However, upon opening the launcher, I was fed a huge pile of crap. It directly downloaded over 1 GB of resources. Without a second thought, I knew it was CEF. To prevent my system from getting yet another Chromium instance, I thought perhaps I could develop a third-party launcher.

## Game Resources

First, I need to get the direct download links for the game resources. This process is very simple; the network connection logs are inevitably recorded by the launcher, so I just need to read them briefly.

First, check the time, then start the game launcher and click "start download". After downloading for about half a minute, close the launcher, and start looking for the logs:
```bash
rg '2026-04-21 13:37'
```
The output is very long so I won't paste it all. Here is the key information:
```bash
NTELauncher/UserData/Log/Patcher/log/patcher_updater.log
...
NTELauncher/UserData/Log/Patcher/log/publish_PC.log
...
1449:2026-04-21 13:37:25.275 [tid:532] [DEBUG] @[PatcherSDKImpl::Init] initInfo(updateUrl: https://yhcdn1.wmupd.com/clientRes, backupUpdateUrl: https://yhcdn2.wmupd.com/clientRes) // CDN location found
...
1465:2026-04-21 13:37:25.277 [tid:1348] [TRACE] @[ResourceDownloadFileTask::AddFile] https://yhcdn1.wmupd.com/clientRes/publish_PC/Version/Windows/config.xml?tValue=1776749845277 // Requested an xml obviously related to game resources here, will check later
...
1523:2026-04-21 13:37:30.722 [tid:708] [DEBUG] @[PatcherSDK::SafeConfigFileRead] Z:/home/origuchi/.local/share/Steam/steamapps/common/nte launcher/Neverness To Everness/NTELauncher/UserData/Patcher/PatcherSDK/ResList.xml // Read ResList.xml from local cache
...
1631:2026-04-21 13:37:30.958 [tid:724] [TRACE] @[ResourceDownloadFileTask::AddPackFiles] publish_PC/Res/5/547d51e659c8d4ea6ce79ab5c386ded6.113831224.
1632:2026-04-21 13:37:30.958 [tid:724] [TRACE] @[ResourceDownloadFileTask::AddPackFiles] publish_PC/Res/7/70aecfd573afbea554dcd7f68798a6f5.241488016.
1633:2026-04-21 13:37:30.958 [tid:724] [TRACE] @[ResourceDownloadFileTask::AddPackFiles] publish_PC/Res/a/ab190b1bd80ce94e62e18537e09914dd.248182892. // Everything below here is repeated AddPackFiles
...
1868:2026-04-21 13:37:30.981 [tid:740] [DEBUG] @[ResourceDownloadClient::Request] request: https://yhcdn1.wmupd.com/clientRes/publish_PC/Res/5/547d51e659c8d4ea6ce79ab5c386ded6.113831224, 49197400-113831223 64633824 bytes
1869:2026-04-21 13:37:30.981 [tid:740] [DEBUG] @[HttpClient_Curl::Setup] request https://yhcdn1.wmupd.com/clientRes/publish_PC/Res/5/547d51e659c8d4ea6ce79ab5c386ded6.113831224 // Network request starts downloading
```
From the logs, the following points can be observed:
1. `PatchSDK` is the tool used to request game resource downloads.
2. Game resources are named in this very strange format: `publish_PC/Res/5/547d51e659c8d4ea6ce79ab5c386ded6.113831224`.
3. `ResList.xml` was read from the local cache, so it is currently unknown where it was downloaded from.
4. `https://yhcdn1.wmupd.com/clientRes/publish_PC/Version/Windows/config.xml?tValue=1776749845277` is closely related to the game resource location, but the value of `tValue` cannot be inferred yet.

Now, let's solve them one by one.

### ResList.xml

First is the issue of the `ResList.xml` local cache. This is definitely because I downloaded it once during a previous launch and it had already been requested, so the cache wasn't deleted beforehand during later testing, causing it to read directly from the cache.

Searching the logs:
```bash
rg -i 'reslist'
UserData/Log/Patcher/log/publish_PC.log
83:2026-04-21 12:32:59.537 [tid:888] [TRACE] @[ResourceDownloadFileTask::AddFile] publish_PC/Version/Windows/version/1.0.3/ResList.bin.zip
89:2026-04-21 12:32:59.539 [tid:1276] [DEBUG] @[ResourceDownloadFileTask::_InitTaskFile] [0]init for Z:/home/origuchi/.local/share/Steam/steamapps/common/nte launcher/Neverness To Everness/NTELauncher/UserData/Patcher/PatcherSDK/tmp/ResList.bin.zip
93:2026-04-21 12:32:59.540 [tid:1276] [DEBUG] @[ResourceDownloadClient::Request] request: https://yhcdn2.wmupd.com/clientRes/publish_PC/Version/Windows/version/1.0.3/ResList.bin.zip
...
```
OK, found it. Then I downloaded this zip file and extracted it to find two files: `lastdiff.bin` and `ResList.bin`. They are two binary `.bin` files, not the final `.xml` files.

However, after comparing these `.bin` files with the locally cached `.xml` files, I surprisingly found that the data corresponding to the `.bin` and `.xml` files are exactly the same. That is, after downloading and extracting, it just renamed the `.bin` file directly to `.xml`. In fact, that `.xml` file is a sort of disguise; they are still unreadable binary files.

By the way, a key point: both files have "PatcherXML0" at the beginning. I'll explain what this is used for later.

### tValue

`tValue=1776749845277`. First, looking at the log, this `tValue` field always appears at the end of the request link `https://yhcdn1.wmupd.com/clientRes/publish_PC/Version/Windows/config.xml`, and its value is not fixed.

I asked Gemini, and it immediately knew this is just a UTC timestamp. I checked `<https://www.utctime.net/utc-timestamp>` and it indeed currently starts with `17767...`, which, combined with the log time, confirms this theory.

I tested whether changing this value affects the requested content, and it seems it doesn't. That means it's currently irrelevant.

Then, regarding the content returned by the link itself, the general structure is as follows:
```xml
<config>
<AppVersion>0.0</AppVersion>
<ResVersion>1.0.3</ResVersion>
<UpdateResVersion>0.0</UpdateResVersion>
<Section>1.0</Section>
<ResSize>47399967798</ResSize>
<Hash>e5906c</Hash>
<BaseVerson appVersion="0.0">
<Res section="0.104" version="0.104.4" Tag="pakchunk104" ResSize="898354337"/>
<Res section="..." version="..." Tag="..." ResSize="..."/>
...
<Res section="1.0" version="1.0.3" Tag="baseTag" ResSize="47399967798"/>
</BaseVerson>
<Tag>baseTag</Tag>
<Extra>
<BaseTag>
<item name="baseTag"/>
</BaseTag>
<speed>50</speed>
<maxThreadCnt>5</maxThreadCnt>
<tagTaskThreadCnt>2</tagTaskThreadCnt>
<diffHash>e34d9d55982e5ec8457e2af50de467ed</diffHash>
<listHash>681b5a3903f31e425a2a23f16b3fbb4c</listHash>
<playAssetsTimeout>20</playAssetsTimeout>
<Devices>
<d name="cc62a32400090313b8eb85691b97459b_00059a3c7a00"/>
<d name="..."/>
...
</Devices>
<Compressed>1</Compressed>
<Encrypt>1</Encrypt>
</Extra>
</config>
```

The versions and sizes of the game resources are known here, and `diffHash` and `listHash` are the hashes of the two files mentioned above.

### Resource Naming

I have no development experience myself and had completely no idea what this mess was. I asked Gemini, and it directly told me this is `{First letter of Hash}/{Full MD5 Hash}.{Total file size}`. I didn't expect it to be named like this, but I tested downloading a file and it was indeed true. Therefore, the method to construct the direct resource links later is very simple. The key point remains how to get the list containing the file path/filename/MD5/file size (`ResList.xml`).

### PatchSDK

Look directly for whether this file exists:
```bash
fd -IH patchersdk
PatcherSDK_x64.dll
UserData/Patcher/PatcherSDK/
```
It can be inferred that this `PatcherSDK_x64.dll` is the tool that appeared in the logs, used for downloading the game patch.

Then check the contents under `UserData/Patcher/PatcherSDK/`
```bash
tree UserData/Patcher/PatcherSDK/
UserData/Patcher/PatcherSDK/
├── internal
├── ResList.xml
├── server
└── tmp
    ├── client.xml
    ├── lastdiff.xml
    ├── Res
    │   └── Client
    │       └── WindowsNoEditor
    │           └── HT
    │               ├── Binaries
    │               │   └── Win64
    │               │       ├── AntiCheatExpert
    │               │       │   └── ACE-Base.dat
    │               │       └── HTGameBase.dll.cb
    │               └── Content
    │                   ├── Movies
    │                   │   └── FFMpeg_Mana
    │                   │       ├── advert
    │                   │       │   └── ...
    │                   │       ├── Login2K-huanghun.usm
    │                   │       ├── RoomInvite
    │                   │       │   └── xiaozhi
    │                   │       │       └── ...
    │                   │       ├── Story
    │                   │       │   └── ...
    │                   │       └── Void
    │                   │           └── ...
    │                   └── PatchPaks
    │                       └── ...
    └── ResList.xml

20 directories, 51 files
```
It can be seen that `ResList.xml` and `lastdiff.xml`, the two things mentioned earlier, are both here. And what's inside `UserData/Patcher/PatcherSDK/tmp/Res/Client` is the cache during the download process. This confirms that PatcherSDK is used to fetch game resources, which requires focus in subsequent research.

## .dll Analysis

Now starting the analysis of `PatcherSDK_x64.dll`, using the free software [IDA Free](https://hex-rays.com/ida-free) developed by [hex-rays](https://hex-rays.com/).

First load `PatcherSDK_x64.dll`. Since both `.bin` files that need to be unpacked have the string `PatcherXML0` at their headers, it's reasonable to deduce that the dll will read this string. So I directly tried to search for the String "PatcherXML0" in IDA.
```plain
.rdata:0000000180543E18 aPatchersdkRead db 'PatcherSDK::ReadProtectedFile',0
.rdata:0000000180543E18                                          ; DATA XREF: sub_180138C40+8A↑o
.rdata:0000000180543E18                                          ; sub_180138C40:loc_180138D20↑o ...
.rdata:0000000180543E36                 align 20h
.rdata:0000000180543E40 aCfgFileTooLarg db 'cfg file too large. not correct!',0
.rdata:0000000180543E40                                          ; DATA XREF: sub_180138C40+D9↑o
.rdata:0000000180543E61                 align 8
.rdata:0000000180543E68 aCanNotOpenEncr db 'can not open encrypted file.',0
.rdata:0000000180543E68                                          ; DATA XREF: sub_180138C40+169↑o
.rdata:0000000180543E85                 align 10h
.rdata:0000000180543E90 aTheSizeNotMatc db 'the size not matched. %d %d',0
.rdata:0000000180543E90                                          ; DATA XREF: sub_180138C40+345↑o
```
This is written very clearly, showing the reading and error handling process of the `PatcherSDK::ReadProtectedFile` method, and the function called is `sub_180138C40`.

I tried to view the assembly code of `sub_180138C40`. Since it's not a language I like, I directly pressed F5 to decompile it into C pseudocode, as follows:
```c
__int64 __fastcall sub_180138C40(__int64 a1, const char *a2)
{
  const char *v2; // rbx
  __int64 v4; // rax
  int v5; // ebx
  size_t v6; // rbx
  unsigned __int64 v7; // rsi
  _BYTE *v8; // r14
  _BYTE *v9; // rax
  void **v10; // rdx
  __int64 v11; // rbx
  void **v12; // rdx
  void *Src[2]; // [rsp+30h] [rbp-D0h] BYREF
  __int128 v15; // [rsp+40h] [rbp-C0h]
  char Destination[12]; // [rsp+50h] [rbp-B0h] BYREF
  int v17; // [rsp+5Ch] [rbp-A4h] BYREF
  __int128 v18; // [rsp+60h] [rbp-A0h] BYREF
  __int128 v19; // [rsp+70h] [rbp-90h]
  void *pExceptionObject[3]; // [rsp+80h] [rbp-80h] BYREF
  unsigned __int64 v21; // [rsp+98h] [rbp-68h]
  void *Block[3]; // [rsp+A0h] [rbp-60h] BYREF
  unsigned __int64 v23; // [rsp+B8h] [rbp-48h]
  _BYTE v24[64]; // [rsp+C0h] [rbp-40h] BYREF

  v2 = a2;
  *(_QWORD *)Destination = a1;
  sub_1800067A3((unsigned int)v24, (_DWORD)a2, 0, 1, 0);
  if ( !(unsigned __int8)sub_180003DDC(v24, "rb") )
  {
    v4 = sub_1800118DD(Block);
    if ( *(_QWORD *)(v4 + 24) >= 0x10u )
      v4 = *(_QWORD *)v4;
    if ( *((_QWORD *)v2 + 3) >= 0x10u )
      v2 = *(const char **)v2;
    sub_18000860C(4, "PatcherSDK::ReadProtectedFile", "%s open failed. %s", v2, (const char *)v4);
    if ( v23 >= 0x10 )
      j_free(Block[0]);
    goto LABEL_8;
  }
  v5 = sub_1800092B9(v24);
  if ( v5 > 104857600 )
  {
    sub_18000860C(4, "PatcherSDK::ReadProtectedFile", "cfg file too large. not correct!");
    goto LABEL_8;
  }
  v17 = 0;
  j_strncpy(Destination, "PatcherXML0", 0xCu);
  v17 = 0;
  sub_18000ACD6(v24, Destination, 12);
  sub_18000ACD6(v24, &v17, 4);
  if ( j_strcmp(Destination, "PatcherXML0") )
  {
    Src[0] = nullptr;
    *(_QWORD *)&v15 = 0;
    *((_QWORD *)&v15 + 1) = 15;
    sub_180011C2F(Src);
    v12 = Src;
    if ( *((_QWORD *)&v15 + 1) >= 0x10u )
      v12 = (void **)Src[0];
    sub_18000ACD6(v24, v12, v5);
    *(_OWORD *)a1 = *(_OWORD *)Src;
    *(_OWORD *)(a1 + 16) = v15;
    goto LABEL_40;
  }
  if ( qword_180667C80 )
  {
    v6 = v5 - 16LL;
    Src[0] = nullptr;
    *(_QWORD *)&v15 = 0;
    *((_QWORD *)&v15 + 1) = 15;
    if ( v6 > 0xF )
    {
      v7 = 0x7FFFFFFFFFFFFFFFLL;
      if ( v6 > 0x7FFFFFFFFFFFFFFFLL )
        std::vector<void *>::_Xlen();
      if ( (v6 | 0xF) <= 0x7FFFFFFFFFFFFFFFLL )
      {
        v7 = v6 | 0xF;
        if ( (v6 | 0xF) < 0x16 )
          v7 = 22;
      }
      v9 = j_j_j__malloc_base(v7 + 1);
      v8 = v9;
      if ( !v9 )
      {
        sub_180012FEE(pExceptionObject);
        j__CxxThrowException(pExceptionObject, (_ThrowInfo *)&pThrowInfo);
      }
      *(_QWORD *)&v15 = v6;
      *((_QWORD *)&v15 + 1) = v7;
      j_memset(v9, 0, v6);
      v8[v6] = 0;
      Src[0] = v8;
    }
    else
    {
      *(_QWORD *)&v15 = v6;
      j_memset(Src, 0, v6);
      *((_BYTE *)Src + v6) = 0;
      v7 = *((_QWORD *)&v15 + 1);
      v8 = Src[0];
    }
    v10 = Src;
    if ( v7 >= 0x10 )
      v10 = (void **)v8;
    sub_18000ACD6(v24, v10, v6);
    v21 = 15;
    pExceptionObject[2] = (void *)10;
    strcpy((char *)pExceptionObject, "PatcherSDK");
    v11 = sub_180009ACF(Block, Src, &qword_180667C70, pExceptionObject);
    if ( Src != (void **)v11 )
    {
      if ( *((_QWORD *)&v15 + 1) >= 0x10u )
        j_free(Src[0]);
      *(_QWORD *)&v15 = 0;
      *((_QWORD *)&v15 + 1) = 15;
      LOBYTE(Src[0]) = 0;
      *(_OWORD *)Src = *(_OWORD *)v11;
      v15 = *(_OWORD *)(v11 + 16);
      *(_QWORD *)(v11 + 16) = 0;
      *(_QWORD *)(v11 + 24) = 15;
      *(_BYTE *)v11 = 0;
    }
    if ( v23 >= 0x10 )
      j_free(Block[0]);
    Block[2] = nullptr;
    v23 = 15;
    LOBYTE(Block[0]) = 0;
    if ( v21 >= 0x10 )
      j_free(pExceptionObject[0]);
    *(_QWORD *)&v18 = 0;
    *(_QWORD *)&v19 = 0;
    *((_QWORD *)&v19 + 1) = 15;
    sub_180006794(Src, &v18);
    if ( (_QWORD)v19 != v17 )
      sub_18000860C(3, "PatcherSDK::ReadProtectedFile", "the size not matched. %d %d", v17, (_DWORD)v15);
    *(_OWORD *)a1 = v18;
    *(_OWORD *)(a1 + 16) = v19;
    *(_QWORD *)&v19 = 0;
    *((_QWORD *)&v19 + 1) = 15;
    LOBYTE(v18) = 0;
    if ( *((_QWORD *)&v15 + 1) >= 0x10u )
      j_free(Src[0]);
LABEL_40:
    LOBYTE(Src[0]) = 0;
    *((_QWORD *)&v15 + 1) = 15;
    *(_QWORD *)&v15 = 0;
    goto LABEL_41;
  }
  sub_18000860C(4, "PatcherSDK::ReadProtectedFile", "can not open encrypted file.");
LABEL_8:
  *(_QWORD *)a1 = 0;
  *(_QWORD *)(a1 + 24) = 15;
  *(_BYTE *)a1 = 0;
  *(_QWORD *)(a1 + 16) = 0;
  *(_BYTE *)a1 = 0;
LABEL_41:
  sub_180005E2A(v24);
  return a1;
}
```
Let's briefly analyze it:
1. Read the file `a2`.
2. `sub_18000ACD6(v24, Destination, 12)` reads the first 12 bytes of the file, which is `PatcherXML0\0` (`\0` is the string terminator).
3. `sub_18000ACD6(v24, &v17, 4)` reads four bytes and stores them into `v17`.
4. Payload `v6=v5-16LL`: The total file size minus the 12-byte header and the 4-byte variable leaves the encrypted data.
5. `strcmp(Destination,"PatcherXML0") != 0` directly reads all content and passes it to `a1`, indicating that if the header lacks the `PatcherXML0` marker, it's treated as a normal unencrypted file.
6. `strcpy((char *)pExceptionObject, "PatcherSDK")`, meaning the value of `pExceptionObject` is just the string `"PatcherSDK"`.
7. `sub_180009ACF(Block, Src, &qword_180667C70, pExceptionObject)` is the decryption function.
8. `sub_180006794` is highly likely decompressing? After decompression, it passes to `v18/v19`.
9. `v19 != v17` check: if the final decrypted data `v19` does not equal `v17`, it passes `v19` to `a1`.
10. Outputs `a1`, and destroys all intermediate resources.

Our need is to find the decryption method, so naturally, we need to look at the most important decryption function `sub_180009ACF`. OK, continue to open the assembly of the `sub_180009ACF` function and press F5 to decompile.
```c
// attributes: thunk
__int64 __fastcall sub_180009ACF(__int64 a1, __int64 a2, __int64 a3, __int64 a4)
{
  return sub_1801E7F10(a1, a2, a3, a4);
}
```
It's a thunk function, the real decryption function is `sub_1801E7F10`. OK, decompile it.
```c
__int64 __fastcall sub_1801E7F10(__int64 a1, _QWORD *a2, void *a3, void *a4)
{
  __int64 v7; // r8
  __int64 v8; // rax
  __int64 v9; // rax
  unsigned __int64 v10; // rbx
  __int64 v11; // r14
  void *v12; // rax
  __int64 v13; // r14
  void **v14; // rdi
  void **v15; // rbx
  int v16; // eax
  char *v17; // rax
  char *v18; // rdi
  void **v19; // r9
  __int64 v21; // [rsp+38h] [rbp-91h] BYREF
  void *Block[2]; // [rsp+40h] [rbp-89h] BYREF
  unsigned __int64 v23; // [rsp+50h] [rbp-79h]
  unsigned __int64 v24; // [rsp+58h] [rbp-71h]
  void *v25[2]; // [rsp+60h] [rbp-69h] BYREF
  unsigned __int64 v26; // [rsp+70h] [rbp-59h]
  unsigned __int64 v27; // [rsp+78h] [rbp-51h]
  void *v28[2]; // [rsp+80h] [rbp-49h] BYREF
  unsigned __int64 v29; // [rsp+90h] [rbp-39h]
  unsigned __int64 v30; // [rsp+98h] [rbp-31h]
  __int128 Src; // [rsp+A0h] [rbp-29h] BYREF
  __int128 v32; // [rsp+B0h] [rbp-19h]
  void *pExceptionObject[3]; // [rsp+C0h] [rbp-9h] BYREF
  unsigned __int64 v34; // [rsp+D8h] [rbp+Fh]

  v21 = a1;
  sub_180008355(v28, a4);
  sub_180008355(v25, a3);
  if ( v29 < 0x10 )
  {
    LOBYTE(v7) = 48;
    v8 = sub_18000186B(pExceptionObject, 16 - v29, v7);
    j_unknown_libname_1146(v28, v8);
    if ( v34 >= 0x10 )
      j_free(pExceptionObject[0]);
  }
  if ( v26 < 0x10 )
  {
    LOBYTE(v7) = 48;
    v9 = sub_18000186B(pExceptionObject, 16 - v26, v7);
    j_unknown_libname_1146(v25, v9);
    if ( v34 >= 0x10 )
      j_free(pExceptionObject[0]);
  }
  Block[0] = nullptr;
  v23 = 0;
  v24 = 0;
  v10 = a2[2];
  if ( a2[3] >= 0x10u )
    a2 = (_QWORD *)*a2;
  if ( v10 >= 0x10 )
  {
    v11 = v10 | 0xF;
    if ( (v10 | 0xF) > 0x7FFFFFFFFFFFFFFFLL )
      v11 = 0x7FFFFFFFFFFFFFFFLL;
    v12 = j_j_j__malloc_base(v11 + 1);
    if ( !v12 )
    {
      sub_180012FEE(pExceptionObject);
      j__CxxThrowException(pExceptionObject, (_ThrowInfo *)&pThrowInfo);
    }
    Block[0] = v12;
    j_memmove(v12, a2, v10 + 1);
    v24 = v11;
  }
  else
  {
    *(_OWORD *)Block = *(_OWORD *)a2;
    v24 = 15;
  }
  v23 = v10;
  v13 = sub_18000E606();
  if ( v13 )
  {
    v14 = v28;
    if ( v30 >= 0x10 )
      v14 = (void **)v28[0];
    v15 = v25;
    if ( v27 >= 0x10 )
      LODWORD(v15) = v25[0];
    v16 = sub_18000C5EF();
    if ( (unsigned int)sub_180003FFD(v13, v16, 0, (int)v15, v14) == 1 )
    {
      LODWORD(v21) = 0;
      v17 = (char *)j_j_j___2_YAPEAX_K_Z((int)v23);
      v18 = v17;
      v19 = Block;
      if ( v24 >= 0x10 )
        LODWORD(v19) = Block[0];
      if ( (unsigned int)sub_180009F5C(v13, (_DWORD)v17, (unsigned int)&v21, (_DWORD)v19, v23) == 1 )
      {
        if ( (unsigned int)sub_1800057CC(v13, &v18[(int)v21], &v21) == 1 )
        {
          sub_180008116(v13);
          *(_QWORD *)&Src = 0;
          *(_QWORD *)&v32 = 0;
          *((_QWORD *)&v32 + 1) = 15;
          sub_180001686(&Src);
          j_j_j_j_j_free_0(v18);
          *(_OWORD *)a1 = Src;
          *(_OWORD *)(a1 + 16) = v32;
          *(_QWORD *)&v32 = 0;
          *((_QWORD *)&v32 + 1) = 15;
          LOBYTE(Src) = 0;
        }
        else
        {
          sub_18000860C(4, "_pw_sdk_10_base::Encrypt::DecryptWithAES128", "chiper finish error");
          *(_QWORD *)a1 = 0;
          *(_QWORD *)(a1 + 24) = 15;
          *(_BYTE *)a1 = 0;
          *(_QWORD *)(a1 + 16) = 0;
          *(_BYTE *)a1 = 0;
        }
      }
      else
      {
        sub_18000860C(4, "_pw_sdk_10_base::Encrypt::DecryptWithAES128", "chiper update error");
        *(_QWORD *)a1 = 0;
        *(_QWORD *)(a1 + 24) = 15;
        *(_BYTE *)a1 = 0;
        *(_QWORD *)(a1 + 16) = 0;
        *(_BYTE *)a1 = 0;
      }
    }
    else
    {
      sub_18000860C(4, "_pw_sdk_10_base::Encrypt::DecryptWithAES128", "chiper init error");
      *(_QWORD *)a1 = 0;
      *(_QWORD *)(a1 + 24) = 15;
      *(_BYTE *)a1 = 0;
      *(_QWORD *)(a1 + 16) = 0;
      *(_BYTE *)a1 = 0;
    }
  }
  else
  {
    sub_18000860C(4, "_pw_sdk_10_base::Encrypt::DecryptWithAES128", "ctx error");
    *(_QWORD *)a1 = 0;
    *(_QWORD *)(a1 + 24) = 15;
    *(_BYTE *)a1 = 0;
    *(_QWORD *)(a1 + 16) = 0;
    *(_BYTE *)a1 = 0;
  }
  if ( v24 >= 0x10 )
    j_free(Block[0]);
  v23 = 0;
  v24 = 15;
  LOBYTE(Block[0]) = 0;
  if ( v27 >= 0x10 )
    j_free(v25[0]);
  v26 = 0;
  v27 = 15;
  LOBYTE(v25[0]) = 0;
  if ( v30 >= 0x10 )
    j_free(v28[0]);
  return a1;
}
```
Now the encryption algorithm is known, it's AES-128. The four variables are also clearly known:
1. `a1`: Output decrypted text.
2. `a2`: Input ciphertext.
3. `a3`: Key.
4. `a4`: IV.

Earlier analysis of `sub_180138C40` mentioned that `pExceptionObject`/`a4` is actually the string `"PatcherSDK"`. Padding it with 0 to 16 bytes gives the IV value: `"PatcherSDK000000"`.

The goal now becomes very clear: to get the value of `a3`, which is the AES-Key.

`a3` is the `&qword_180667C70` passed to `sub_180009ACF` earlier. Attempting to find its cross-references:
```c
void **__fastcall sub_18013F720(size_t *a1)
{
  void **result; // rax
  void *v2; // rdx

  result = &qword_180667C70;
  if ( &qword_180667C70 != (void **)a1 )
  {
    v2 = a1;
    if ( a1[3] >= 0x10 )
      v2 = (void *)*a1;
    return (void **)sub_18000B2AD(&qword_180667C70, v2, a1[2]);
  }
  return result;
}
```
This is the function where the Key value is written into `&qword_180667C70`, but it is not called anywhere in this dll. This must mean that it is called in the main program, which then passes the Key value in.

That means I'd have to take the trouble to check the main program, and it's even possible that this value is not hardcoded in the main program but imported from somewhere else. I felt that looking for it directly would be too troublesome.

However, in reality, the memory location of `&qword_180667C70` is already known; it's the base address of `PatcherSDK_x64.dll` + memory offset `667C70`. That actually means if I just run the main program and start the download, the string value of the Key we need will definitely be readable at this location `PatcherSDK_x64.dll+667C70`.

## Debugging

Since the debugger [x64dbg](https://github.com/x64dbg/x64dbg) currently only supports Windows (according to the latest [Release Note](https://github.com/x64dbg/x64dbg/releases/tag/2026.04.20), "the first pre-alpha pieces of a Linux debugger based on the new `ElfBug` engine have been merged", meaning there is already a first version of experimental support for Linux, hopefully it will fully support Linux in the future), a Windows virtual machine needs to be installed. There are many methods; [winboat](https://github.com/TibixDev/winboat) and [winapps](https://github.com/winapps-org/winapps) are both good and convenient installation tools, or using qemu/kvm for a direct installation isn't difficult either. I won't go into details here.

Start x64dbg, load the launcher main program `NTEGame.exe`, switch to the "Symbols" tab, and while pressing F9, observe if `PatcherSDK_x64.dll` gets loaded by the main program.

However, when the breakpoint reached the loading of `ntdll.dll`, the `NTEGame.exe` process crashed and a popup appeared: "Please close the debugger and try again".

This situation couldn't be more common. It indicates that when its launcher process loads `ntdll.dll`, it detects whether it is currently being debugged.

The solution is very simple; just bring out our anti-anti-debug plugin [ScyllaHide](https://github.com/x64dbg/ScyllaHide).

First, run the launcher program directly. Wait until it is fully loaded, use the Attach process feature of ScyllaHide, aim the crosshair at the `NTEGame.exe` window to get its process PID, then click Attach to load the process into x64dbg.

Still looking at the "Symbols" tab first, `PatcherSDK_x64.dll` appeared, indicating that `PatcherSDK_x64.dll` was successfully loaded after the launcher was opened and fully loaded.

Go to the "Memory" window, press `Ctrl+G` to search for `PatcherSDK_x64.dll+667C70`, and jump to the memory location of `&qword_180667C70`. x64dbg has already automatically converted the hexadecimal to ASCII characters, displaying:
```plain
1289@Patcher....
```
A 12-character string. Padding it with 0 to 16 bytes, we get the final AES-Key as `1289@Patcher0000`.

## Testing

So far, the AES-Key and AES-IV have been obtained through simple reverse engineering. Now its validity needs to be tested.
```python
import os
from Crypto.Cipher import AES

def unpack(file_path):
    key = b"1289@Patcher0000"
    iv = b"PatcherSDK000000"
    
    with open(file_path, 'rb') as f:
        data = f.read()
        
    payload = data[16:]
    
    cipher = AES.new(key, AES.MODE_CBC, iv)
    dec = cipher.decrypt(payload)
    save(file_path, dec)

def save(original_path, final_data):
    out_path = original_path + ".xml"
    with open(out_path, 'wb') as f:
        f.write(final_data)

if __name__ == "__main__":
    unpack("ResList.bin")
    unpack("lastdiff.bin")
```
Opening the decrypted files, it was all gibberish. Checking their file header hex values, they were all `789C`, which made me think it was highly likely that the file was first zlib compressed and then AES encrypted.

So, let's add a layer of decompression:
```python
import os
import zlib
from Crypto.Cipher import AES

def unpack(file_path):
    key = b"1289@Patcher0000"
    iv = b"PatcherSDK000000"
    
    with open(file_path, 'rb') as f:
        data = f.read()
        
    payload = data[16:]
    
    cipher = AES.new(key, AES.MODE_CBC, iv)
    dec = cipher.decrypt(payload)
    
    decompressor = zlib.decompressobj()
    xml = decompressor.decompress(dec)
    save(file_path, xml)

def save(original_path, final_data):
    out_path = original_path + ".xml"
    with open(out_path, 'wb') as f:
        f.write(final_data)

if __name__ == "__main__":
    unpack("ResList.bin")
    unpack("lastdiff.bin")
```
The previews of the two final `.xml` files obtained are as follows:
```xml
<?xml version="1.0" ?>
<PatchList>
	<Patch oldfile="574d464afa067f98975e6272c41d4629.56443408" newfile="ff96060fa4cb662b3757c2251a8f0154.98867728" patch="a10e03ac369bdfdef426add6a74ae454.46537895" v="e5906c"/>
	<Patch oldfile="..." newfile="..." patch="..." v="..."/>
	...
```
```xml
<?xml version="1.0" ?>
<ResList version="1.0.3" tag="baseTag">
	<Res filename="Client/WindowsNoEditor/Engine/Binaries/ThirdParty/CEF3/Win64/libcef.dll" filesize="153114624" md5="3a1cb9e5814c6a22261824396f79b55d"/>
	<Res filename="..." filesize="..." md5="..."/>
	...
```
> PS: I couldn't help but laugh that the first file was CEF.

## Conclusion

None (It feels so good not to be forced to write a conclusion).
