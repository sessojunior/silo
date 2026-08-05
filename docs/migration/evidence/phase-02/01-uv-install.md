# Fase 2.1 — instalação do uv

Data: 2026-07-22  
Status: concluído

## Resultado

`uv` foi instalado na versão exata exigida pelo plano:

```text
uv 0.11.28 (ebf0f43d7 2026-07-07 x86_64-pc-windows-msvc)
```

Path instalado:

```text
C:\Users\sesso\.local\bin\uv.exe
```

Observação operacional: neste processo do Codex, `uv` ainda não aparece como comando bare no PATH herdado. Para os próximos comandos desta sessão, usar:

```powershell
$env:Path = "$env:USERPROFILE\.local\bin;$env:Path"
```

antes de chamar `uv`.

## Tentativa inicial corrigida

A primeira tentativa usou `https://astral.sh/uv/install.ps1` com `UV_VERSION=0.11.28`, mas esse script estava fixado em `0.11.31` e instalou a versão errada. O gate foi tratado como falha, a causa foi corrigida e o comando de instalação foi repetido com o instalador oficial versionado:

```text
https://astral.sh/uv/0.11.28/install.ps1
```

## Checksum

Artefato oficial verificado:

```text
uv-x86_64-pc-windows-msvc.zip
```

Checksum oficial:

```text
0a23463216d09c6a72ff80ef5dc5a795f07dc1575cb84d24596c2f124a441b7b
```

Checksum calculado:

```text
0a23463216d09c6a72ff80ef5dc5a795f07dc1575cb84d24596c2f124a441b7b
```

Hash SHA-256 do `uv.exe` instalado, comparado com o `uv.exe` extraído do artefato oficial:

```text
533fe4044bc50b05ac89f4d07925597fdb5285369724e8986ecab356818f09ee
```

## Comandos executados

```powershell
$env:UV_NO_MODIFY_PATH = '1'
$installScript = Invoke-RestMethod -Uri 'https://astral.sh/uv/0.11.28/install.ps1'
Invoke-Expression $installScript
& "$env:USERPROFILE\.local\bin\uv.exe" --version
```

```powershell
Invoke-WebRequest -Uri "https://github.com/astral-sh/uv/releases/download/0.11.28/uv-x86_64-pc-windows-msvc.zip" -OutFile $zipPath
Invoke-WebRequest -Uri "https://github.com/astral-sh/uv/releases/download/0.11.28/uv-x86_64-pc-windows-msvc.zip.sha256" -OutFile $shaPath
Get-FileHash -Algorithm SHA256 -Path $zipPath
Expand-Archive -Path $zipPath -DestinationPath $extract
Get-FileHash -Algorithm SHA256 -Path "$env:USERPROFILE\.local\bin\uv.exe"
```

Validação final:

```text
uv 0.11.28 (ebf0f43d7 2026-07-07 x86_64-pc-windows-msvc)
```
