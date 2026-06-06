# MetaboLift Monorepo Yapisi

Bu proje, mobil, web ve backend bolumleri ayri klasorlerde olacak sekilde duzenlendi.

## Klasor Yapisi

- `mobile/`: React Native mobil uygulamasi (Android/iOS)
- `web/`: React web uygulamasi
- `backend/`: Node.js API ve Python analiz kodlari

Ek bilgi:
- `web/legacy/frontend/` klasoru eski web denemeleri icin arsiv olarak tutuluyor.
- `backend/.venv/` klasoru Python sanal ortami.

## Calistirma

### Koku kullanarak tek komut

```bash
npm run install:all
```

Ardindan ihtiyaca gore:

```bash
npm run mobile
npm run web
npm run backend
```

Platform bazli mobil komutlari:

```bash
npm run mobile:android
npm run mobile:ios
```

### Mobil

```bash
cd mobile
npm install
npm start
```

Ayrica:

```bash
cd mobile
npm run android
# veya
npm run ios
```

### Web

```bash
cd web
npm install
npm start
```

### Backend

```bash
cd backend
npm install
node server.js
```

Firebase kurulumu:

- Firebase Console uzerinden service account olustur.
- Ornek ortam dosyasini kopyala:

```bash
cp backend/.env.example backend/.env
```

- `backend/.env` dosyasina asagidaki alanlari ekle:

```env
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_CLIENT_EMAIL=your-service-account-email
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
```

Alternatif olarak tek satir JSON da kullanabilirsin:

```env
FIREBASE_SERVICE_ACCOUNT_JSON={"type":"service_account", ...}
```
