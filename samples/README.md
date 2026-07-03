# サンプルExcel帳票

設計書（docs/design/system-design-v0.6-part2-excel-format.md）のフォーマットに準拠したサンプルデータ。
3ファイルは同一シナリオでつながっている。

- **物理構成Excel_サンプル.xlsx**：ECU（Engine_00/10, Body_00, Meter_00）・バス（Body_bus_00/10, Engine_bus_00）・トポロジー・GWリスト（Engine_00がGW-ECU）
- **通信データExcel_サンプル.xlsx**：Frame_001（エンジン回転数・車速）をEngine_10が送信、Body_00とMeter_00が受信
- **GW例外指定Excel_サンプル.xlsx**：Frame_001をEngine_bus→Body_busへ転送する経路をEngine_00経由に固定

物理構成Excel_サンプル.xlsxはP10画面（LAN構成管理）から実際にインポートして動作確認済み。
通信データ・GW例外指定Excelは対応するインポート機能が未実装（Phase1-4予定）のため、フォーマット参考用。
