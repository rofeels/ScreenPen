# ScreenPen

> [English](./README.md) | 한국어

ScreenPen은 드로잉 오버레이, 자동 줌, 커서 효과, 크로마키 등을 갖춘 **무료 크리에이터 지향 데스크톱 화면 녹화/편집 앱**입니다.

![ScreenPen 데모](./recordlydemo.gif)

## 주요 기능

- macOS / Windows 캡처 경로 기반 화면 녹화
- **드로잉 오버레이** — 녹화 중 화면에 그리기
- **클릭 / 키스트로크 / 레이저 포인터** 시각 효과
- 자동 줌과 커서 움직임 보정
- 웹캠 오버레이 + **크로마키** 지원
- 타임라인 기반 편집
- MP4 / GIF 내보내기
- 프로젝트 저장/불러오기 (`.screenpen`, 기존 `.screencraft` / `.recordly` / `.openscreen` 지원)
- 다국어 UI (한국어, 영어, 스페인어, 중국어)

## 빌드 / 실행

### macOS 로컬 빌드

```bash
git clone https://github.com/rofeels/ScreenPen.git
cd ScreenPen
npm install
npm run build:mac
```

빌드 결과물은 `release/` 아래에 생성됩니다.

응용 프로그램 폴더에 설치하려면:

```bash
cp -R release/mac-arm64/ScreenPen.app /Applications/ScreenPen.app
```

## 개발

```bash
npm install
npm run dev
```

자주 쓰는 명령어:

```bash
npm run typecheck
npm test
npm run build:mac
```

## 저장소 링크

- 저장소: https://github.com/rofeels/ScreenPen
- 이슈: https://github.com/rofeels/ScreenPen/issues

## 원작 표기

ScreenPen은 다음 프로젝트를 기반으로 합니다:
- [Recordly](https://github.com/webadderall/Recordly) by webadderall (원본 프로젝트)
- [ScreenCraft](https://github.com/NewTurn2017/ScreenCraft) by NewTurn2017 (한글화 포크)

## 라이선스

MIT
