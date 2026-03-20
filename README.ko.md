# ScreenCraft

> [English](./README.md) | 한국어

ScreenCraft는 더 보기 좋은 데모, 튜토리얼, 제품 소개 영상을 만들기 위한 **크리에이터 지향 데스크톱 화면 녹화/편집 앱**입니다.

이 저장소는 원작인 [webadderall/Recordly](https://github.com/webadderall/Recordly)의 **공개 포크**이며, 그 포크 관계를 의도적으로 유지합니다.

![ScreenCraft 데모](./recordlydemo.gif)

## ScreenCraft에서 하는 일

- macOS / Windows 캡처 경로 기반 화면 녹화
- 자동 줌과 커서 움직임 보정
- 웹캠 오버레이 지원
- 타임라인 기반 편집
- MP4 / GIF 내보내기
- 프로젝트 저장 / 불러오기 (`.screencraft`, 기존 `.recordly` / `.openscreen` 불러오기 지원)

## 빌드 / 실행

### macOS 로컬 빌드

```bash
git clone https://github.com/NewTurn2017/ScreenCraft.git
cd ScreenCraft
npm install
npm run build:mac
```

빌드 결과물은 `release/` 아래에 생성됩니다.

응용 프로그램 폴더에 설치하려면:

```bash
cp -R release/mac-arm64/ScreenCraft.app /Applications/ScreenCraft.app
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

- 저장소: https://github.com/NewTurn2017/ScreenCraft
- 이슈: https://github.com/NewTurn2017/ScreenCraft/issues
- 원본 업스트림: https://github.com/webadderall/Recordly

## 원작 표기

ScreenCraft는 [webadderall](https://github.com/webadderall)의 Recordly를 기반으로 발전시키는 프로젝트입니다.

원본 포크 관계는 계속 남겨둡니다.

## 라이선스

MIT
