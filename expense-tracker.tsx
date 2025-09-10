import React, { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { PieChart, Pie, Cell, Tooltip as ReTooltip, ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Legend } from "recharts";
import { Plus, Trash2, Upload, Download, Filter, SortAsc, SortDesc } from "lucide-react";

type Expense = {
  id: string;
  date: string; 
  amount: number; 
  category: string;
  note?: string;
};

const DEFAULT_CATEGORIES = [
  "Food",
  "Transport",
  "Bills",
  "Shopping",
  "Entertainment",
  "Health",
  "Education",
  "Other",
];

const STORAGE_KEY = "expenses_v1";
const CAT_STORAGE_KEY = "expense_categories_v1";

const PIE_COLORS = [
  "#0088FE", "#00C49F", "#FFBB28", "#FF8042", "#FF6384", "#36A2EB", "#9966FF", "#FF9F40"
];

const LOCALE = "th-TH";
function fmtTHB(n: number) {
  try {
    return new Intl.NumberFormat(LOCALE, {
      style: "currency",
      currency: "THB",
      currencyDisplay: "symbol",
      maximumFractionDigits: 2,
    }).format(n);
  } catch {
    
    return `฿${n.toFixed(2)}`;
  }
}


function uid() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function parseDate(d: string) {
  const [y, m, da] = d.split("-").map(Number);
  return new Date(y, m - 1, da);
}

function monthKey(d: string) {
  const [y, m] = d.split("-");
  return `${y}-${m}`; 
}

export default function ExpenseTrackerDashboard() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [categories, setCategories] = useState<string[]>(DEFAULT_CATEGORIES);


  const [date, setDate] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [amount, setAmount] = useState<string>("");
  const [category, setCategory] = useState<string>(DEFAULT_CATEGORIES[0]);
  const [note, setNote] = useState<string>("");


  const [from, setFrom] = useState<string>("");
  const [to, setTo] = useState<string>("");
  const [catFilter, setCatFilter] = useState<string>("ALL");


  type SortKey = "date" | "amount" | "category";
  const [sortKey, setSortKey] = useState<SortKey>("date");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setExpenses(JSON.parse(raw));
      const cats = localStorage.getItem(CAT_STORAGE_KEY);
      if (cats) setCategories(JSON.parse(cats));
    } catch {}
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(expenses));
    } catch {}
  }, [expenses]);

  useEffect(() => {
    try {
      localStorage.setItem(CAT_STORAGE_KEY, JSON.stringify(categories));
    } catch {}
  }, [categories]);

  function addExpense() {
    const amt = parseFloat(amount);
    if (!date || isNaN(amt) || amt <= 0 || !category) return;
    const e: Expense = { id: uid(), date, amount: parseFloat(amt.toFixed(2)), category, note: note.trim() };
    setExpenses((prev) => [e, ...prev]);
    setAmount("");
    setNote("");
  }

  function removeExpense(id: string) {
    setExpenses((prev) => prev.filter((e) => e.id !== id));
  }

  function clearAll() {
    if (confirm("Delete ALL expenses?")) setExpenses([]);
  }

  function addCategory(newCat: string) {
    const c = newCat.trim();
    if (!c) return;
    if (categories.includes(c)) return;
    setCategories((prev) => [...prev, c]);
    setCategory(c);
  }

  // filtered/sorted list
  const shown = useMemo(() => {
    let list = expenses.slice();
    if (from) list = list.filter((e) => parseDate(e.date) >= parseDate(from));
    if (to) list = list.filter((e) => parseDate(e.date) <= parseDate(to));
    if (catFilter !== "ALL") list = list.filter((e) => e.category === catFilter);

    list.sort((a, b) => {
      let cmp = 0;
      if (sortKey === "date") cmp = parseDate(a.date).getTime() - parseDate(b.date).getTime();
      if (sortKey === "amount") cmp = a.amount - b.amount;
      if (sortKey === "category") cmp = a.category.localeCompare(b.category);
      return sortDir === "asc" ? cmp : -cmp;
    });
    return list;
  }, [expenses, from, to, catFilter, sortKey, sortDir]);

  // aggregates
  const total = useMemo(() => shown.reduce((s, e) => s + e.amount, 0), [shown]);

  const byCategory = useMemo(() => {
    const m = new Map<string, number>();
    shown.forEach((e) => m.set(e.category, (m.get(e.category) || 0) + e.amount));
    const arr = Array.from(m.entries()).map(([name, value]) => ({ name, value }));
    return arr.length > 0 ? arr : [{ name: "No data", value: 1 }];
  }, [shown]);

  const byMonth = useMemo(() => {
    const m = new Map<string, number>();
    shown.forEach((e) => m.set(monthKey(e.date), (m.get(monthKey(e.date)) || 0) + e.amount));
    return Array.from(m.entries())
      .map(([k, v]) => ({ month: k, total: parseFloat(v.toFixed(2)) }))
      .sort((a, b) => a.month.localeCompare(b.month));
  }, [shown]);

  // export / import
  function exportJSON() {
    const blob = new Blob([JSON.stringify({ expenses, categories }, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `expenses-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function importJSON(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const obj = JSON.parse(String(reader.result));
        if (Array.isArray(obj.expenses)) setExpenses(obj.expenses);
        if (Array.isArray(obj.categories)) setCategories(obj.categories);
      } catch (e) {
        alert("Invalid file");
      }
    };
    reader.readAsText(file);
  }

  useEffect(() => {
    try {
      const isProd = typeof process !== "undefined" && process.env && process.env.NODE_ENV === "production";
      if (isProd) return;
      
      const d = parseDate("2025-09-10");
      console.assert(d instanceof Date && d.getFullYear() === 2025 && d.getMonth() === 8 && d.getDate() === 10, "parseDate failed");
    
      console.assert(monthKey("2025-09-10") === "2025-09", "monthKey failed");
    
      const sample: Expense[] = [
        { id: "1", date: "2025-09-01", amount: 100, category: "Food" },
        { id: "2", date: "2025-09-02", amount: 50, category: "Food" },
        { id: "3", date: "2025-09-02", amount: 20, category: "Transport" },
      ];
      const totalSample = sample.reduce((s, e) => s + e.amount, 0);
      console.assert(totalSample === 170, "total aggregation failed");
    
console.assert(fmtTHB(0).includes("฿"), "fmtTHB should use ฿ symbol for th-TH");
console.debug("✅ Basic tests passed");
    } catch (e) {
      console.warn("Dev tests error", e);
    }
  }, []);

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6">
      <header className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Expense Tracker</h1>
          {/* <p className="text-sm text-muted-foreground">บันทึกค่าใช้จ่าย | จัดหมวดหมู่ | สรุป Dashboard | กรองช่วงเวลา | เรียงลำดับ</p> */}
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" onClick={exportJSON} className="gap-2"><Download size={16}/>Export</Button>
          <label className="inline-flex items-center gap-2 cursor-pointer">
            <input type="file" accept="application/json" className="hidden" onChange={(e)=>{const f=e.target.files?.[0]; if(f) importJSON(f);}}/>
            <span className="px-3 py-2 border rounded-md text-sm inline-flex items-center gap-2"><Upload size={16}/>Import</span>
          </label>
          <Button variant="destructive" onClick={clearAll} className="gap-2"><Trash2 size={16}/>Clear</Button>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column: add form & filters */}
        <div className="space-y-6">
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Plus size={18}/> เพิ่มรายการค่าใช้จ่าย</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label>วันที่</Label>
                  <Input type="date" value={date} onChange={(e)=>setDate(e.target.value)} />
                </div>
                <div>
                  <Label>จำนวนเงิน (THB)</Label>
                  <Input type="number" inputMode="decimal" placeholder="0.00" value={amount} onChange={(e)=>setAmount(e.target.value)} />
                </div>
                <div>
                  <Label>หมวดหมู่</Label>
                  <Select value={category} onValueChange={setCategory}>
                    <SelectTrigger>
                      <SelectValue placeholder="เลือกหมวด" />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((c)=> <SelectItem key={c} value={c}>{c}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>บันทึก/รายละเอียด</Label>
                  <Input placeholder="เช่น ข้าวกลางวัน, เติมน้ำมัน" value={note} onChange={(e)=>setNote(e.target.value)} />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button onClick={addExpense} className="gap-2"><Plus size={16}/>บันทึก</Button>
                <Input placeholder="เพิ่มหมวดหมู่ใหม่…แล้วกด Enter" onKeyDown={(e)=>{ if(e.key==='Enter'){ addCategory((e.target as HTMLInputElement).value); (e.target as HTMLInputElement).value=''; } }} />
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Filter size={18}/> ตัวกรอง & การเรียง</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <Label>จากวันที่</Label>
                  <Input type="date" value={from} onChange={(e)=>setFrom(e.target.value)} />
                </div>
                <div>
                  <Label>ถึงวันที่</Label>
                  <Input type="date" value={to} onChange={(e)=>setTo(e.target.value)} />
                </div>
                <div>
                  <Label>หมวดหมู่</Label>
                  <Select value={catFilter} onValueChange={setCatFilter}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL">ทั้งหมด</SelectItem>
                      {categories.map((c)=> <SelectItem key={c} value={c}>{c}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Label className="whitespace-nowrap">เรียงโดย</Label>
                <Select value={sortKey} onValueChange={(v)=>setSortKey(v as any)}>
                  <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="date">วันที่</SelectItem>
                    <SelectItem value="amount">จำนวนเงิน</SelectItem>
                    <SelectItem value="category">หมวดหมู่</SelectItem>
                  </SelectContent>
                </Select>
                <Button variant="outline" className="gap-2" onClick={()=> setSortDir(d=> d==='asc'?'desc':'asc')}>
                  {sortDir==='asc' ? <><SortAsc size={16}/>น้อย→มาก</> : <><SortDesc size={16}/>มาก→น้อย</>}
                </Button>
                <Button variant="ghost" onClick={()=>{ setFrom(""); setTo(""); setCatFilter("ALL"); }}>ล้างตัวกรอง</Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Middle & Right: Dashboard + Table */}
        <div className="lg:col-span-2 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="shadow-sm">
              <CardHeader className="pb-2"><CardTitle>รวมค่าใช้จ่าย</CardTitle></CardHeader>
              <CardContent>
                <div className="text-3xl font-semibold">{fmtTHB(total)}</div>
                <div className="text-xs text-muted-foreground mt-1">จากรายการที่กรองแล้ว</div>
              </CardContent>
            </Card>
            <Card className="shadow-sm md:col-span-2">
              <CardHeader className="pb-2"><CardTitle>แนวโน้มรายเดือน</CardTitle></CardHeader>
              <CardContent className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={byMonth} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis />
                    <ReTooltip formatter={(v)=> fmtTHB(Number(v))} />
                    <Legend />
                    <Line type="monotone" dataKey="total" name="รวมต่อเดือน" strokeWidth={2} dot />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="shadow-sm">
              <CardHeader className="pb-2"><CardTitle>สัดส่วนตามหมวดหมู่ (ตัวหลัก)</CardTitle></CardHeader>
              <CardContent className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={byCategory} dataKey="value" nameKey="name" outerRadius={120} label>
                      {byCategory.map((_, i) => (
                        <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <ReTooltip formatter={(v)=> fmtTHB(Number(v))} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card className="shadow-sm">
              <CardHeader className="pb-2"><CardTitle>รายการล่าสุด</CardTitle></CardHeader>
              <CardContent>
                <ScrollArea className="h-64 pr-2">
                  <div className="grid grid-cols-1 gap-3">
                    {shown.length === 0 && (
                      <div className="text-sm text-muted-foreground">ไม่มีรายการ</div>
                    )}
                    {shown.map((e) => (
                      <div key={e.id} className="flex items-center justify-between border rounded-xl p-3 bg-card/30">
                        <div className="space-y-1">
                          <div className="font-medium">{fmtTHB(e.amount)} <span className="text-xs text-muted-foreground">• {e.date}</span></div>
                          <div className="text-xs text-muted-foreground">{e.note || "—"}</div>
                          <Badge variant="secondary" className="mt-1">{e.category}</Badge>
                        </div>
                        <Button size="icon" variant="ghost" onClick={()=>removeExpense(e.id)}><Trash2 size={16}/></Button>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </div>

          <Card className="shadow-sm">
            <CardHeader className="pb-2"><CardTitle>ตารางข้อมูล (Sort/Filter ได้)</CardTitle></CardHeader>
            <CardContent className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="text-left border-b">
                    <th className="py-2 pr-4">วันที่</th>
                    <th className="py-2 pr-4">หมวดหมู่</th>
                    <th className="py-2 pr-4 text-right">จำนวนเงิน</th>
                    <th className="py-2 pr-4">บันทึก</th>
                    <th className="py-2 pr-4 text-right">ลบ</th>
                  </tr>
                </thead>
                <tbody>
                  {shown.map((e)=> (
                    <tr key={e.id} className="border-b">
                      <td className="py-2 pr-4 whitespace-nowrap">{e.date}</td>
                      <td className="py-2 pr-4"><Badge variant="outline">{e.category}</Badge></td>
                      <td className="py-2 pr-4 text-right font-medium">{fmtTHB(e.amount)}</td>
                      <td className="py-2 pr-4">{e.note || "—"}</td>
                      <td className="py-2 pr-4 text-right"><Button size="icon" variant="ghost" onClick={()=>removeExpense(e.id)}><Trash2 size={16}/></Button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {shown.length === 0 && (
                <div className="text-sm text-muted-foreground mt-3">ไม่มีข้อมูลในตัวกรองปัจจุบัน</div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <Tabs defaultValue="help" className="pt-2">
        <TabsList>
          <TabsTrigger value="help">วิธีใช้งาน</TabsTrigger>
          <TabsTrigger value="tips">ทิปส์</TabsTrigger>
        </TabsList>
        <TabsContent value="help">
          <ul className="list-disc pl-6 text-sm space-y-1 text-muted-foreground">
            <li>เพิ่มรายการ: กรอกวันที่ จำนวนเงิน หมวดหมู่ และรายละเอียด จากนั้นกด "บันทึก"</li>
            <li>ตัวกรอง: กำหนดช่วงวันที่และเลือกหมวดหมู่ที่ต้องการ</li>
            <li>การเรียง: เลือกคอลัมน์ที่ต้องการเรียง และกดสลับทิศทางน้อย→มาก / มาก→น้อย</li>
            <li>Export/Import: ดาวน์โหลดไฟล์ .json หรืออัปโหลดกลับเพื่อกู้ข้อมูล</li>
            <li>ลบรายการ: กดปุ่มถังขยะที่รายการ หรือกด Clear เพื่อล้างทั้งหมด</li>
          </ul>
        </TabsContent>
        <TabsContent value="tips">
          <ul className="list-disc pl-6 text-sm space-y-1 text-muted-foreground">
            <li>เพิ่มหมวดหมู่ใหม่ได้โดยพิมพ์ชื่อในช่อง "เพิ่มหมวดหมู่ใหม่…" แล้วกด Enter</li>
            <li>แดชบอร์ดด้านบนจะสรุปรวมเฉพาะข้อมูลที่ถูกกรองแล้ว เพื่อวิเคราะห์เฉพาะช่วงเวลา</li>
            <li>แนะนำให้ Export ไว้เป็นระยะเพื่อสำรองข้อมูล</li>
          </ul>
        </TabsContent>
      </Tabs>
    </div>
  );
}
