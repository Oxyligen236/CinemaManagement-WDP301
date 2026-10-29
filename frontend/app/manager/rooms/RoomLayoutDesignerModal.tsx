'use client';

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  X,
  Sparkles,
  Columns,
  Rows,
  Layers,
  Undo2,
  Trash2,
  Check,
  Footprints,
  Armchair,
  Info,
  Maximize2,
} from 'lucide-react';

export type SeatCellType =
  | 'STANDARD'
  | 'VIP'
  | 'COUPLE'
  | 'MAINTENANCE'
  | 'AISLE';

export interface CustomSeatData {
  rowPosition: string; // 'A', 'B', 'C'
  columnPosition: number; // 1, 2, 3...
  seatType: 'STANDARD' | 'VIP' | 'COUPLE';
  status?: 'AVAILABLE' | 'BLOCKED' | 'MAINTENANCE';
}

interface RoomLayoutDesignerModalProps {
  isOpen: boolean;
  onClose: () => void;
  roomName: string;
  initialRows?: number;
  initialCols?: number;
  initialSeats?: CustomSeatData[];
  onSaveLayout: (seats: CustomSeatData[]) => Promise<void>;
  isSaving: boolean;
  isExistingRoom?: boolean;
}

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

export default function RoomLayoutDesignerModal({
  isOpen,
  onClose,
  roomName,
  initialRows = 8,
  initialCols = 12,
  initialSeats = [],
  onSaveLayout,
  isSaving,
  isExistingRoom = false,
}: RoomLayoutDesignerModalProps) {
  const [rowCount, setRowCount] = useState<number>(initialRows);
  const [colCount, setColCount] = useState<number>(initialCols);
  const [rowInput, setRowInput] = useState<string>(String(initialRows));
  const [colInput, setColInput] = useState<string>(String(initialCols));
  const [activeTool, setActiveTool] = useState<SeatCellType>('STANDARD');
  const wasOpenRef = useRef<boolean>(false);

  // Matrix: key = `${rowLabel}-${col}` -> SeatCellType
  const [grid, setGrid] = useState<Record<string, SeatCellType>>({});
  const [history, setHistory] = useState<Record<string, SeatCellType>[]>([]);
  const [isMouseDown, setIsMouseDown] = useState<boolean>(false);

  // Initialize or reset grid from initialSeats or dimensions
  const initializeGrid = useCallback(
    (rows: number, cols: number, seats: CustomSeatData[]) => {
      const newGrid: Record<string, SeatCellType> = {};

      // First default all to AISLE
      for (let r = 0; r < rows; r++) {
        const rowLabel = ALPHABET[r] ?? `R${r + 1}`;
        for (let c = 1; c <= cols; c++) {
          newGrid[`${rowLabel}-${c}`] = 'AISLE';
        }
      }

      if (seats && seats.length > 0) {
        for (const s of seats) {
          const key = `${s.rowPosition}-${s.columnPosition}`;
          let cellType: SeatCellType = 'STANDARD';
          if (s.status === 'MAINTENANCE' || s.status === 'BLOCKED') {
            cellType = 'MAINTENANCE';
          } else if (s.seatType === 'VIP') {
            cellType = 'VIP';
          } else if (s.seatType === 'COUPLE') {
            cellType = 'COUPLE';
          } else {
            cellType = 'STANDARD';
          }
          newGrid[key] = cellType;
        }
      } else {
        // Standard default preset: Standard in front, VIP in center, Couple in back
        for (let r = 0; r < rows; r++) {
          const rowLabel = ALPHABET[r] ?? `R${r + 1}`;
          const isLastRow = r === rows - 1 && rows >= 4;
          const isVipRow = r >= Math.floor(rows / 2) && !isLastRow;

          for (let c = 1; c <= cols; c++) {
            const key = `${rowLabel}-${c}`;
            if (isLastRow) {
              newGrid[key] = 'COUPLE';
            } else if (isVipRow) {
              newGrid[key] = 'VIP';
            } else {
              newGrid[key] = 'STANDARD';
            }
          }
        }
      }

      setGrid(newGrid);
      setHistory([]);
    },
    [],
  );

  useEffect(() => {
    if (isOpen && !wasOpenRef.current) {
      wasOpenRef.current = true;
      const r = Math.max(
        3,
        Math.min(
          20,
          initialSeats.length > 0
            ? Math.max(
                ...initialSeats.map((s) => ALPHABET.indexOf(s.rowPosition) + 1),
                initialRows,
              )
            : initialRows,
        ),
      );
      const c = Math.max(
        4,
        Math.min(
          30,
          initialSeats.length > 0
            ? Math.max(
                ...initialSeats.map((s) => s.columnPosition),
                initialCols,
              )
            : initialCols,
        ),
      );
      setRowCount(r);
      setColCount(c);
      setRowInput(String(r));
      setColInput(String(c));
      initializeGrid(r, c, initialSeats);
    } else if (!isOpen) {
      wasOpenRef.current = false;
    }
  }, [isOpen, initialRows, initialCols, initialSeats, initializeGrid]);

  // Global mouse up handler to stop drag painting
  useEffect(() => {
    const handleMouseUp = () => setIsMouseDown(false);
    window.addEventListener('mouseup', handleMouseUp);
    return () => window.removeEventListener('mouseup', handleMouseUp);
  }, []);

  const pushHistory = (currentGrid: Record<string, SeatCellType>) => {
    setHistory((prev) => [...prev.slice(-15), { ...currentGrid }]);
  };

  const handleUndo = () => {
    if (history.length === 0) return;
    const previous = history[history.length - 1];
    setHistory((prev) => prev.slice(0, -1));
    setGrid(previous);
  };

  const paintCell = (rowLabel: string, col: number) => {
    const key = `${rowLabel}-${col}`;
    if (grid[key] === activeTool) return;
    pushHistory(grid);
    setGrid((prev) => ({
      ...prev,
      [key]: activeTool,
    }));
  };

  const handleCellMouseDown = (rowLabel: string, col: number) => {
    setIsMouseDown(true);
    paintCell(rowLabel, col);
  };

  const handleCellMouseEnter = (rowLabel: string, col: number) => {
    if (isMouseDown) {
      paintCell(rowLabel, col);
    }
  };

  // Quick paint entire row
  const paintRow = (rowLabel: string) => {
    pushHistory(grid);
    setGrid((prev) => {
      const next = { ...prev };
      for (let c = 1; c <= colCount; c++) {
        next[`${rowLabel}-${c}`] = activeTool;
      }
      return next;
    });
  };

  // Quick paint entire column
  const paintColumn = (col: number) => {
    pushHistory(grid);
    setGrid((prev) => {
      const next = { ...prev };
      for (let r = 0; r < rowCount; r++) {
        const rowLabel = ALPHABET[r] ?? `R${r + 1}`;
        next[`${rowLabel}-${col}`] = activeTool;
      }
      return next;
    });
  };

  // Apply row/col dimension resizing
  const handleResizeGrid = (newR: number, newC: number) => {
    const clampedR = Math.max(3, Math.min(20, newR));
    const clampedC = Math.max(4, Math.min(30, newC));
    setRowCount(clampedR);
    setColCount(clampedC);

    pushHistory(grid);
    setGrid((prev) => {
      const next: Record<string, SeatCellType> = {};
      for (let r = 0; r < clampedR; r++) {
        const rowLabel = ALPHABET[r] ?? `R${r + 1}`;
        for (let c = 1; c <= clampedC; c++) {
          const key = `${rowLabel}-${c}`;
          next[key] = prev[key] ?? 'STANDARD';
        }
      }
      return next;
    });
  };

  const handleStepRow = (delta: number) => {
    const next = Math.max(3, Math.min(20, rowCount + delta));
    setRowInput(String(next));
    handleResizeGrid(next, colCount);
  };

  const handleStepCol = (delta: number) => {
    const next = Math.max(4, Math.min(30, colCount + delta));
    setColInput(String(next));
    handleResizeGrid(rowCount, next);
  };

  const handleRowChange = (valStr: string) => {
    setRowInput(valStr);
    const num = parseInt(valStr, 10);
    if (!Number.isNaN(num) && num >= 3 && num <= 20) {
      handleResizeGrid(num, colCount);
    }
  };

  const handleRowBlur = () => {
    const num = parseInt(rowInput, 10);
    const clamped = Number.isNaN(num) || num < 3 ? 3 : Math.min(20, num);
    setRowInput(String(clamped));
    handleResizeGrid(clamped, colCount);
  };

  const handleColChange = (valStr: string) => {
    setColInput(valStr);
    const num = parseInt(valStr, 10);
    if (!Number.isNaN(num) && num >= 4 && num <= 30) {
      handleResizeGrid(rowCount, num);
    }
  };

  const handleColBlur = () => {
    const num = parseInt(colInput, 10);
    const clamped = Number.isNaN(num) || num < 4 ? 4 : Math.min(30, num);
    setColInput(String(clamped));
    handleResizeGrid(rowCount, clamped);
  };

  // Preset 1: 1 Lối đi ở giữa
  const applyPresetCenterAisle = () => {
    pushHistory(grid);
    const centerCol = Math.ceil(colCount / 2);
    setGrid((prev) => {
      const next: Record<string, SeatCellType> = {};
      for (let r = 0; r < rowCount; r++) {
        const rowLabel = ALPHABET[r] ?? `R${r + 1}`;
        const isLastRow = r === rowCount - 1 && rowCount >= 4;
        const isVipRow = r >= Math.floor(rowCount / 2) && !isLastRow;

        for (let c = 1; c <= colCount; c++) {
          const key = `${rowLabel}-${c}`;
          if (c === centerCol) {
            next[key] = 'AISLE';
          } else if (isLastRow) {
            next[key] = 'COUPLE';
          } else if (isVipRow) {
            next[key] = 'VIP';
          } else {
            next[key] = 'STANDARD';
          }
        }
      }
      return next;
    });
  };

  // Preset 2: 2 Lối đi 2 bên (3 phần: Cánh trái - Lối đi - Khu giữa - Lối đi - Cánh phải)
  const applyPresetDoubleAisle = () => {
    pushHistory(grid);
    const leftAisle = Math.max(2, Math.floor(colCount * 0.25));
    const rightAisle = Math.min(colCount - 1, Math.ceil(colCount * 0.75));

    setGrid(() => {
      const next: Record<string, SeatCellType> = {};
      for (let r = 0; r < rowCount; r++) {
        const rowLabel = ALPHABET[r] ?? `R${r + 1}`;
        const isLastRow = r === rowCount - 1 && rowCount >= 4;
        const isVipRow = r >= Math.floor(rowCount / 2) && !isLastRow;

        for (let c = 1; c <= colCount; c++) {
          const key = `${rowLabel}-${c}`;
          if (c === leftAisle || c === rightAisle) {
            next[key] = 'AISLE';
          } else if (isLastRow) {
            next[key] = 'COUPLE';
          } else if (isVipRow) {
            next[key] = 'VIP';
          } else {
            next[key] = 'STANDARD';
          }
        }
      }
      return next;
    });
  };

  // Preset 3: Toàn bộ VIP
  const applyPresetAllVIP = () => {
    pushHistory(grid);
    setGrid((prev) => {
      const next = { ...prev };
      for (let r = 0; r < rowCount; r++) {
        const rowLabel = ALPHABET[r] ?? `R${r + 1}`;
        for (let c = 1; c <= colCount; c++) {
          const key = `${rowLabel}-${c}`;
          if (next[key] !== 'AISLE') {
            next[key] = 'VIP';
          }
        }
      }
      return next;
    });
  };

  // Preset 4: Xóa trắng toàn bộ thành Ghế Thường
  const applyResetAllStandard = () => {
    pushHistory(grid);
    const next: Record<string, SeatCellType> = {};
    for (let r = 0; r < rowCount; r++) {
      const rowLabel = ALPHABET[r] ?? `R${r + 1}`;
      for (let c = 1; c <= colCount; c++) {
        next[`${rowLabel}-${c}`] = 'STANDARD';
      }
    }
    setGrid(next);
  };

  // Stats calculation
  const stats = useMemo(() => {
    let standard = 0;
    let vip = 0;
    let couple = 0;
    let maintenance = 0;
    let aisle = 0;

    for (let r = 0; r < rowCount; r++) {
      const rowLabel = ALPHABET[r] ?? `R${r + 1}`;
      for (let c = 1; c <= colCount; c++) {
        const type = grid[`${rowLabel}-${c}`] ?? 'STANDARD';
        if (type === 'STANDARD') standard++;
        else if (type === 'VIP') vip++;
        else if (type === 'COUPLE') couple++;
        else if (type === 'MAINTENANCE') maintenance++;
        else if (type === 'AISLE') aisle++;
      }
    }

    const totalSeats = standard + vip + couple + maintenance;
    return { standard, vip, couple, maintenance, aisle, totalSeats };
  }, [grid, rowCount, colCount]);

  // Convert current grid to API seats format
  const handleSave = async () => {
    const seatsToSave: CustomSeatData[] = [];

    for (let r = 0; r < rowCount; r++) {
      const rowLabel = ALPHABET[r] ?? `R${r + 1}`;
      for (let c = 1; c <= colCount; c++) {
        const type = grid[`${rowLabel}-${c}`];
        if (type === 'AISLE') {
          // Aisle cells do not generate seat documents
          continue;
        }

        let seatType: 'STANDARD' | 'VIP' | 'COUPLE' = 'STANDARD';
        let status: 'AVAILABLE' | 'MAINTENANCE' = 'AVAILABLE';

        if (type === 'VIP') {
          seatType = 'VIP';
        } else if (type === 'COUPLE') {
          seatType = 'COUPLE';
        } else if (type === 'MAINTENANCE') {
          seatType = 'STANDARD';
          status = 'MAINTENANCE';
        }

        seatsToSave.push({
          rowPosition: rowLabel,
          columnPosition: c,
          seatType,
          status,
        });
      }
    }

    await onSaveLayout(seatsToSave);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-3 backdrop-blur-xs select-none font-['Arial',sans-serif]">
      <div className="flex flex-col w-full max-w-[1100px] max-h-[95vh] border-2 border-[#c1b687] bg-[#fcfbfa] shadow-2xl overflow-hidden font-['Arial',sans-serif]">
        {/* ================================================================= */}
        {/* HEADER                                                            */}
        {/* ================================================================= */}
        <div className="flex items-center justify-between bg-[#231f20] px-6 py-4 border-b-2 border-[#c1b687]">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center border border-[#c1b687] bg-[#231f20] text-[#c1b687]">
              <Layers className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-[17px] font-bold uppercase text-white">
                Trình Vẽ & Thiết Kế Layout Phòng Chiếu
              </h2>
              <p className="text-[12px] text-[#c1b687] mt-0.5">
                {roomName ? `Đang thiết kế cho: ${roomName}` : 'Phòng chiếu mới'} • Latte Cinema Standard
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center text-[#c1b687] hover:bg-[#332e2f] hover:text-white transition-colors cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* ================================================================= */}
        {/* CONTROLS BAR: BRUSH TOOLS & DIMENSIONS & PRESETS                  */}
        {/* ================================================================= */}
        <div className="bg-[#efebdb] border-b border-[#dad2b4] p-4 flex flex-wrap items-center justify-between gap-4">
          {/* Tool Palette */}
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#6f6247] mr-1">
              Bút vẽ:
            </span>

            <button
              type="button"
              onClick={() => setActiveTool('STANDARD')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-bold border transition-all cursor-pointer ${
                activeTool === 'STANDARD'
                  ? 'border-[#231f20] bg-white text-[#231f20] shadow-md ring-2 ring-[#231f20]'
                  : 'border-[#9d9580] bg-white/70 text-[#444] hover:bg-white'
              }`}
            >
              <span className="h-3.5 w-3.5 border-2 border-[#9d9580] bg-white inline-block" />
              Ghế Thường
            </button>

            <button
              type="button"
              onClick={() => setActiveTool('VIP')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-bold border transition-all cursor-pointer ${
                activeTool === 'VIP'
                  ? 'border-[#b49b57] bg-[#efebdb] text-[#6f6247] shadow-md ring-2 ring-[#b49b57]'
                  : 'border-[#c1b687] bg-white/70 text-[#6f6247] hover:bg-white'
              }`}
            >
              <span className="h-3.5 w-3.5 border-2 border-[#b49b57] bg-[#efebdb] inline-block" />
              Ghế VIP
            </button>

            <button
              type="button"
              onClick={() => setActiveTool('COUPLE')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-bold border transition-all cursor-pointer ${
                activeTool === 'COUPLE'
                  ? 'border-[#da291c] bg-[#fff1f2] text-[#da291c] shadow-md ring-2 ring-[#da291c]'
                  : 'border-[#fca5a5] bg-white/70 text-[#da291c] hover:bg-white'
              }`}
            >
              <span className="h-3.5 w-3.5 border-2 border-[#da291c] bg-[#ffe4e6] inline-block" />
              Ghế Đôi
            </button>

            <button
              type="button"
              onClick={() => setActiveTool('MAINTENANCE')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-bold border transition-all cursor-pointer ${
                activeTool === 'MAINTENANCE'
                  ? 'border-black bg-[#231f20] text-[#c1b687] shadow-md ring-2 ring-black'
                  : 'border-[#231f20] bg-[#231f20]/20 text-[#231f20] hover:bg-[#231f20] hover:text-[#c1b687]'
              }`}
            >
              <span className="h-3.5 w-3.5 bg-[#231f20] border border-black inline-block" />
              Ghế Khóa/Bảo trì
            </button>

            <button
              type="button"
              onClick={() => setActiveTool('AISLE')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-bold border transition-all cursor-pointer ${
                activeTool === 'AISLE'
                  ? 'border-[#da291c] bg-white text-[#da291c] shadow-md ring-2 ring-[#da291c]'
                  : 'border-dashed border-[#888] bg-white/40 text-[#666] hover:bg-white'
              }`}
            >
              <Footprints className="h-3.5 w-3.5 text-[#da291c]" />
              Lối đi / Ô trống
            </button>
          </div>

          {/* Grid Dimensions */}
          <div className="flex items-center gap-3">
            {/* Rows Control */}
            <div className="flex items-center gap-1.5 text-[12px] font-bold text-[#231f20]">
              <Rows className="h-4 w-4 text-[#6f6247]" />
              <span>Hàng:</span>
              <div className="flex items-center border border-[#dad2b4] bg-white shadow-2xs">
                <button
                  type="button"
                  onClick={() => handleStepRow(-1)}
                  disabled={rowCount <= 3}
                  title="Giảm 1 hàng"
                  className="w-7 h-8 flex items-center justify-center text-[15px] font-bold text-[#6f6247] hover:bg-[#efebdb] disabled:opacity-30 cursor-pointer"
                >
                  -
                </button>
                <input
                  type="text"
                  inputMode="numeric"
                  value={rowInput}
                  onChange={(e) => handleRowChange(e.target.value)}
                  onBlur={handleRowBlur}
                  onKeyDown={(e) => e.key === 'Enter' && handleRowBlur()}
                  className="w-10 h-8 text-center font-bold text-[13px] text-[#231f20] border-x border-[#dad2b4] focus:outline-none focus:bg-[#fff9f9]"
                />
                <button
                  type="button"
                  onClick={() => handleStepRow(1)}
                  disabled={rowCount >= 20}
                  title="Tăng 1 hàng"
                  className="w-7 h-8 flex items-center justify-center text-[15px] font-bold text-[#6f6247] hover:bg-[#efebdb] disabled:opacity-30 cursor-pointer"
                >
                  +
                </button>
              </div>
            </div>

            {/* Columns Control */}
            <div className="flex items-center gap-1.5 text-[12px] font-bold text-[#231f20]">
              <Columns className="h-4 w-4 text-[#6f6247]" />
              <span>Cột:</span>
              <div className="flex items-center border border-[#dad2b4] bg-white shadow-2xs">
                <button
                  type="button"
                  onClick={() => handleStepCol(-1)}
                  disabled={colCount <= 4}
                  title="Giảm 1 cột"
                  className="w-7 h-8 flex items-center justify-center text-[15px] font-bold text-[#6f6247] hover:bg-[#efebdb] disabled:opacity-30 cursor-pointer"
                >
                  -
                </button>
                <input
                  type="text"
                  inputMode="numeric"
                  value={colInput}
                  onChange={(e) => handleColChange(e.target.value)}
                  onBlur={handleColBlur}
                  onKeyDown={(e) => e.key === 'Enter' && handleColBlur()}
                  className="w-10 h-8 text-center font-bold text-[13px] text-[#231f20] border-x border-[#dad2b4] focus:outline-none focus:bg-[#fff9f9]"
                />
                <button
                  type="button"
                  onClick={() => handleStepCol(1)}
                  disabled={colCount >= 30}
                  title="Tăng 1 cột"
                  className="w-7 h-8 flex items-center justify-center text-[15px] font-bold text-[#6f6247] hover:bg-[#efebdb] disabled:opacity-30 cursor-pointer"
                >
                  +
                </button>
              </div>
            </div>

            {history.length > 0 && (
              <button
                type="button"
                onClick={handleUndo}
                title="Hoàn tác thao tác trước"
                className="flex items-center gap-1 h-8 px-2.5 border border-[#dad2b4] bg-white text-[12px] font-bold text-[#6f6247] hover:bg-[#dad2b4] hover:text-[#231f20] cursor-pointer"
              >
                <Undo2 className="h-3.5 w-3.5" />
                Undo
              </button>
            )}
          </div>
        </div>

        {/* ================================================================= */}
        {/* PRESET TEMPLATES BAR                                              */}
        {/* ================================================================= */}
        <div className="bg-[#f7f5ee] px-4 py-2 border-b border-[#dad2b4] flex flex-wrap items-center justify-between gap-2 text-[12px]">
          <div className="flex items-center gap-1.5 text-[#6f6247]">
            <Sparkles className="h-4 w-4 text-[#da291c]" />
            <span className="font-bold">Mẫu Layout nhanh:</span>
            <button
              type="button"
              onClick={applyPresetCenterAisle}
              className="px-2.5 py-0.5 border border-[#dad2b4] bg-white hover:border-[#da291c] hover:text-[#da291c] font-semibold cursor-pointer"
            >
              1 Lối đi giữa
            </button>
            <button
              type="button"
              onClick={applyPresetDoubleAisle}
              className="px-2.5 py-0.5 border border-[#dad2b4] bg-white hover:border-[#da291c] hover:text-[#da291c] font-semibold cursor-pointer"
            >
              2 Lối đi hai bên
            </button>
            <button
              type="button"
              onClick={applyPresetAllVIP}
              className="px-2.5 py-0.5 border border-[#dad2b4] bg-white hover:border-[#b49b57] hover:text-[#b49b57] font-semibold cursor-pointer"
            >
              Toàn bộ VIP
            </button>
            <button
              type="button"
              onClick={applyResetAllStandard}
              className="px-2.5 py-0.5 border border-[#dad2b4] bg-white hover:border-[#231f20] hover:text-[#231f20] font-semibold cursor-pointer"
            >
              Đặt lại Thường
            </button>
          </div>

          <div className="text-[11px] text-[#8c8269] italic flex items-center gap-1">
            <Info className="h-3.5 w-3.5" />
            <span>Mẹo: Giữ chuột và rê qua các ô để vẽ nhanh; click vào chữ cái Hàng / số Cột để tô cả hàng/cột!</span>
          </div>
        </div>

        {/* ================================================================= */}
        {/* CANVAS DRAWING GRID AREA                                          */}
        {/* ================================================================= */}
        <div className="flex-1 overflow-auto p-6 bg-[#fcfbfa]">
          {/* Curved Screen Banner */}
          <div className="mx-auto max-w-[680px] mb-8 text-center">
            <div className="h-3 border-t-4 border-[#c1b687] rounded-[50%/100%_100%_0_0] shadow-[0_-6px_12px_rgba(193,182,135,0.45)]" />
            <div className="mt-1 flex justify-center">
              <span className="bg-[#231f20] text-[#efebdb] px-6 py-1 text-[11px] font-bold tracking-[0.25em] uppercase border border-[#c1b687] shadow-sm">
                MÀN HÌNH CHIẾU / SCREEN
              </span>
            </div>
            <p className="mt-2 text-[10px] text-[#9d9580] uppercase tracking-wider">
              Khán giả nhìn về phía màn hình chiếu
            </p>
          </div>

          {/* Grid Table */}
          <div className="flex justify-center">
            <div className="inline-block bg-white p-5 border border-[#dad2b4] shadow-sm">
              {/* Column Header Numbers */}
              <div className="flex items-center gap-1.5 mb-2 pl-9">
                {Array.from({ length: colCount }, (_, idx) => idx + 1).map(
                  (col) => (
                    <button
                      key={col}
                      type="button"
                      onClick={() => paintColumn(col)}
                      title={`Click để tô toàn bộ Cột ${col} bằng bút đang chọn`}
                      className="w-8 sm:w-9 h-6 flex items-center justify-center text-[10px] font-bold text-[#6f6247] bg-[#efebdb] hover:bg-[#da291c] hover:text-white transition-colors cursor-pointer border border-[#dad2b4]"
                    >
                      {col}
                    </button>
                  ),
                )}
              </div>

              {/* Rows */}
              <div className="space-y-1.5">
                {Array.from({ length: rowCount }, (_, r) => {
                  const rowLabel = ALPHABET[r] ?? `R${r + 1}`;
                  return (
                    <div key={rowLabel} className="flex items-center gap-1.5">
                      {/* Row Header Button */}
                      <button
                        type="button"
                        onClick={() => paintRow(rowLabel)}
                        title={`Click để tô toàn bộ Hàng ${rowLabel} bằng bút đang chọn`}
                        className="w-7 h-8 sm:h-9 flex items-center justify-center text-[12px] font-bold text-[#6f6247] bg-[#efebdb] hover:bg-[#da291c] hover:text-white transition-colors cursor-pointer border border-[#dad2b4]"
                      >
                        {rowLabel}
                      </button>

                      {/* Cells in Row */}
                      {Array.from({ length: colCount }, (_, cIdx) => {
                        const col = cIdx + 1;
                        const cellKey = `${rowLabel}-${col}`;
                        const cellType = grid[cellKey] ?? 'STANDARD';

                        let cellClass =
                          'border-2 border-[#9d9580] bg-white text-[#231f20] hover:border-[#da291c]';
                        let labelText = `${col}`;

                        if (cellType === 'VIP') {
                          cellClass =
                            'border-2 border-[#b49b57] bg-[#efebdb] text-[#231f20] hover:border-[#da291c]';
                        } else if (cellType === 'COUPLE') {
                          cellClass =
                            'border-2 border-[#da291c] bg-[#ffe4e6] text-[#9f1239] hover:border-[#b91c1c]';
                        } else if (cellType === 'MAINTENANCE') {
                          cellClass =
                            'border-2 border-black bg-[#231f20] text-[#c1b687] hover:border-[#da291c]';
                          labelText = '✕';
                        } else if (cellType === 'AISLE') {
                          cellClass =
                            'border border-dashed border-[#dad2b4] bg-[#f7f5ee]/80 text-[#ccc] hover:border-[#da291c] hover:bg-white';
                          labelText = '';
                        }

                        return (
                          <div
                            key={cellKey}
                            onMouseDown={() =>
                              handleCellMouseDown(rowLabel, col)
                            }
                            onMouseEnter={() =>
                              handleCellMouseEnter(rowLabel, col)
                            }
                            title={
                              cellType === 'AISLE'
                                ? `Ô [${rowLabel}${col}]: Lối đi / Không có ghế`
                                : `Ghế ${rowLabel}${col} (${cellType})`
                            }
                            className={`w-8 sm:w-9 h-8 sm:h-9 flex items-center justify-center text-[11px] font-bold transition-all cursor-pointer select-none ${cellClass}`}
                          >
                            {cellType === 'AISLE' ? (
                              <Footprints className="h-3 w-3 text-[#d3cebe]" />
                            ) : (
                              labelText
                            )}
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* ================================================================= */}
        {/* STATS & FOOTER                                                    */}
        {/* ================================================================= */}
        <div className="bg-[#efebdb] border-t-2 border-[#dad2b4] px-6 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          {/* Capacity stats */}
          <div className="flex flex-wrap items-center gap-4 text-[12px]">
            <span className="font-bold text-[#231f20] flex items-center gap-1.5">
              <Armchair className="h-4 w-4 text-[#da291c]" />
              Tổng ghế thực tế:{' '}
              <strong className="text-[14px] text-[#da291c]">
                {stats.totalSeats} ghế
              </strong>
            </span>
            <span className="text-[#6f6247]">|</span>
            <span className="text-[#6f6247]">
              Thường: <strong className="text-[#231f20]">{stats.standard}</strong>
            </span>
            <span className="text-[#6f6247]">
              VIP: <strong className="text-[#b49b57]">{stats.vip}</strong>
            </span>
            <span className="text-[#6f6247]">
              Đôi: <strong className="text-[#da291c]">{stats.couple}</strong>
            </span>
            <span className="text-[#6f6247]">
              Lối đi: <strong className="text-[#6f6247]">{stats.aisle}</strong>
            </span>
            {stats.maintenance > 0 && (
              <span className="text-[#da291c]">
                Khóa: <strong>{stats.maintenance}</strong>
              </span>
            )}
          </div>

          {/* Action buttons */}
          <div className="flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="h-[38px] px-4 border border-[#dad2b4] bg-white text-[13px] font-bold text-[#6f6247] hover:bg-[#dad2b4] hover:text-[#231f20] cursor-pointer"
            >
              Hủy bỏ
            </button>
            <button
              type="button"
              onClick={() => void handleSave()}
              disabled={isSaving || stats.totalSeats === 0}
              className="h-[38px] px-6 bg-[#da291c] text-[13px] font-bold text-white hover:bg-[#b82116] disabled:opacity-50 cursor-pointer shadow-md flex items-center gap-2"
            >
              {isSaving ? (
                <>
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  <span>Đang lưu...</span>
                </>
              ) : (
                <>
                  <Check className="h-4 w-4" />
                  <span>
                    {isExistingRoom ? 'Lưu & Cập Nhật Sơ Đồ Phòng' : 'Áp Dụng Cho Phòng Mới'}
                  </span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
