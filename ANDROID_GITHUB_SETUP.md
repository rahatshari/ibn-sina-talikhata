# ইবনে সিনা টালিখাতা — GitHub থেকে অটো APK বিল্ড ও ইন-অ্যাপ আপডেট গাইড

এই প্রজেক্টে Android মোবাইল অ্যাপ, একই রিলিজ সিগনেচার, অটো ভার্সন বৃদ্ধি, GitHub Release অটোমেশন এবং ইন-অ্যাপ ডাউনলোড ম্যানেজার যুক্ত করা হয়েছে।

## ১. একবারের জন্য স্থায়ী Keystore তৈরি (একই Signature বজায় রাখতে)

একই সিগনেচারে সবসময় APK তৈরি করতে হলে আপনার কম্পিউটারে একবার একটি `.jks` কী-ফাইল তৈরি করে GitHub Secrets-এ সেভ করতে হবে (অ্যাপটি GitHub-এ push করার আগে):

```bash
chmod +x scripts/generate-keystore.sh
./scripts/generate-keystore.sh
```

> **গুরুত্বপূর্ণ:** `talikhata-release.jks` ফাইল ও এর পাসওয়ার্ড নিরাপদ জায়গায় রেখে দিন (কখনও পাবলিক Git-এ আপলোড করবেন না)।

## ২. GitHub Repository Secrets যোগ করা

আপনার GitHub রিপোজিটরিতে যান: **Settings → Secrets and variables → Actions → New repository secret**, এবং নিচের ৪টি Secret যোগ করুন:

1. `ANDROID_KEYSTORE_BASE64` — `scripts/generate-keystore.sh` চালানোর পর যে Base64 টেক্সট পাবেন
2. `ANDROID_KEYSTORE_PASSWORD` — Keystore তৈরির সময় দেওয়া পাসওয়ার্ড
3. `ANDROID_KEY_ALIAS` — `talikhata` (বা আপনি যে alias দিয়েছেন)
4. `ANDROID_KEY_PASSWORD` — Key-এর পাসওয়ার্ড (সাধারণত একই পাসওয়ার্ড)

## ৩. Firebase Console-এ Release SHA-1 যোগ করা (জিমেইল লগইনের জন্য)

`scripts/generate-keystore.sh` স্ক্রিপ্টের শেষে প্রিন্ট হওয়া **SHA1** ও **SHA256** ফিঙ্গারপ্রিন্ট কপি করে:
1. [Firebase Console](https://console.firebase.google.com/) → প্রজেক্ট **`tali-66089`** খুলুন
2. **Project Settings → Your apps → Android (`com.rahat.talikhata`)** এ গিয়ে **Add fingerprint** এ ক্লিক করে SHA-1 ও SHA-256 সেভ করুন।

## ৪. কীভাবে অটো APK তৈরি ও রিলিজ হবে?

- আপনি যখনই `main` বা `master` ব্রাঞ্চে কোড **git push** করবেন, সাথে সাথে `.github/workflows/android-release.yml` চালু হবে।
- প্রতি পুশে অ্যাপের **Version Name** (`1.0.1`, `1.0.2`, ...) এবং **Version Code** (`101`, `102`, ...) **অটোমেটিক বৃদ্ধি পাবে** — হাতে কিছু বদলাতে হবে না।
- বিল্ড শেষ হলে স্বয়ংক্রিয়ভাবে **GitHub → Releases** সেকশনে সাইন করা `.apk` ফাইল (`IbnSina-TallyKhata-v1.0.x.apk`) আপলোড হয়ে যাবে।
- যেহেতু প্রতিবার একই Keystore দিয়ে সাইন করা হয়, তাই পুরনো অ্যাপ আনইনস্টল না করেই সব বিক্রি ও হিসাব ঠিক রেখে সরাসরি আপডেট ইনস্টল করা যাবে।

## ৫. ইন-অ্যাপ ডাউনলোড ম্যানেজার ও অটো আপডেট

- আপনার ফোনে ইনস্টল করা APK অ্যাপটি খোলার সাথে সাথে GitHub Releases চেক করবে (রিপোজিটরির নাম বিল্ডের সময় অটোমেটিক সেট হয়ে যায়)।
- নতুন ভার্সন এলে ফোনের নোটিফিকেশন বারে **অটো নোটিফিকেশন** আসবে এবং অ্যাপের ভেতরে **নতুন আপডেট ব্যানার** দেখাবে।
- **"ডাউনলোড ও আপডেট"** বাটনে ট্যাপ করলে অ্যাপের ভেতরের ডাউনলোড ম্যানেজারে লাইভ প্রগ্রেসসহ APK ডাউনলোড হবে এবং শেষে **APK ইনস্টল করুন** অপশনে সরাসরি আপডেট হয়ে যাবে।
