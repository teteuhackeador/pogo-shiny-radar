# ⚡ PoGo Shiny Radar ⚜️

> **Radar Inteligente de Pokémons Shiny para Pokémon GO**, desenvolvido sob medida com tema Dark OLED, bypass de limite de 10 pokémons via **Blacklist Recursiva**, **Lazy Reveal** on-demand para preservação de cota de API, marcação e persistência local de capturados no smartphone (`localStorage`), integração com Google Maps / Clipboard e pronto para deploy na **Vercel**.

---

## 🌟 Principais Funcionalidades

1. **Bypass de Limite via Blacklist Recursiva (`/api/hunt`)**:
   - A API original limita as respostas a apenas 10 pokémons por consulta.
   - O backend do PoGo Shiny Radar executa rodadas consecutivas de busca inserindo os IDs encontrados na `blacklist_pokemon_ids`, acumulando dezenas de alvos em tempo real (10, 20, 35, 50+).

2. **Arquitetura de Lazy Reveal com Tratamento de Cooldown (`/api/reveal`)**:
   - A rota de revelação de coordenadas exatas possui um rate limit de 10 chamadas a cada 3 minutos (HTTP 429).
   - O radar exibe a lista completa de shinys sem gastar créditos de satélite antecipadamente.
   - O Mestre pode clicar em **"Revelar Coordenadas Exatas"** apenas nos alvos que realmente decidir caçar.
   - Tratamento automático de status 429 com cronômetro regressivo exibindo quando a cota será renovada.

3. **Marcação e Persistência de Capturados ("Já Peguei")**:
   - Cada card possui o botão de status rápido **"Já Peguei" / "Capturado"**.
   - Salvo automaticamente no `localStorage` do celular. Ao recarregar ou abrir o app mais tarde, os pokémons marcados mantêm o status e o card fica com efeito de arquivado/esmaecido.
   - Abas superiores para alternar entre:
     - 🌟 **Todos**
     - 🎯 **Pendentes** (mostra apenas os que você ainda não capturou!)
     - 🏆 **Capturados**

4. **Ferramentas de Navegação e Cópia em 1 Clique**:
   - Botão **Copiar Coordenadas**: copia instantaneamente `lat,lng` formatado para colar direto no PGSharp, GPS Joystick ou Spoofer.
   - Botão **Google Maps**: abre a rota ou o ponto exato do spawn no aplicativo de mapas do celular.

5. **Filtros e Presets de Farm Global**:
   - **GPS do Smartphone**: botão **"📍 Usar Meu GPS Atual"** para buscar no raio da sua localização física.
   - **Hotspots Recomendados**:
     - 🇨🇦 Toronto / Mississauga (Home Base do Mestre)
     - 🇪🇸 Zaragoza (Mega Spawn europeu)
     - 🇺🇸 Pier 39 (San Francisco)
     - 🇧🇷 Parque Ibirapuera (São Paulo)
     - 🇯🇵 Shinjuku / Shibuya (Tóquio)
     - 🇦🇺 Circular Quay (Sydney)
   - Filtro por **IV Mínimo** (50%+, 80%+, 90%+, 100% Shundo).
   - Ordenação por **Vai Sumir Primeiro** (despawn regressivo), **Maior IV**, **Maior CP** e **Nível**.

---

## 🚀 Como Rodar Localmente

```bash
# 1. Instalar dependências
npm install

# 2. Iniciar servidor de desenvolvimento
npm run dev

# Acesse no navegador ou no celular (via IP local da rede):
# http://localhost:3000
```

---

## ☁️ Deploy na Vercel com 1 Clique

O projeto foi construído sobre o **Next.js App Router**, o que significa que os endpoints `/api/hunt` e `/api/reveal` funcionam nativamente como **Serverless Functions** na Vercel com zero configuração de servidor!

### Passo a passo para o Mestre:
1. Acesse seu painel da [Vercel](https://vercel.com/new).
2. Clique em **"Add New Project"** e selecione o repositório **`teteuhackeador/pogo-shiny-radar`**.
3. Em **Environment Variables** (opcional, já que possui fallbacks internos), você pode configurar:
   - `POGO_JWT_TOKEN`: seu token JWT da API
   - `POGO_TRAINER_CODE`: `489652495004`
4. Clique em **Deploy**.
5. Em menos de 1 minuto seu radar estará online com HTTPS gratuito e acessível direto do celular!

---

## 📱 Dica para Uso no Celular (PWA / Web App)
- No Safari (iOS) ou Chrome (Android), abra o link gerado pela Vercel.
- Toque em **Compartilhar** > **"Adicionar à Tela de Início"**.
- O PoGo Shiny Radar abrirá em tela cheia como um app nativo Dark OLED!
