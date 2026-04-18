// ─────────────────────────────────────────────────────────────
// ADMIN: Apni Google Apps Script Web App URL yahan daalo
// Ek baar set karne ke baad viewer ko URL daalni nahi padegi
// Apps Script → Deploy → Web App → URL copy karo
// ─────────────────────────────────────────────────────────────
export const DEFAULT_WEB_APP_URL = 'https://script.google.com/macros/s/AKfycbxoYeC7J1fpf865v-CHt3x_dodqS9RFOPknMuBEbg5BZnrMhaD-G18qBgr71bDKrY-J/exec';
// Example: export const DEFAULT_WEB_APP_URL = 'https://script.google.com/macros/s/ABC.../exec';

export const MONTHS = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December"
];

export const PG_COLORS = {
  Sunshine:     "#f59e0b",
  Haridarshan:  "#10b981",
  Shivneri:     "#6366f1",
  Crystal:      "#ec4899",
  Torna:        "#14b8a6",
  Rajgad:       "#f97316",
  Heritage:     "#8b5cf6",
  UDAPI:        "#ef4444",
  Shantiniketan:"#0ea5e9",
};

function makeMonthly() {
  const obj = {};
  MONTHS.forEach(m => { obj[m] = { amount: "", halfFull: "", collector: "", note: "" }; });
  return obj;
}

export const INITIAL_DATA = {
  Sunshine: [
    { name:"pratima mishra", contact:"7405147554", deposit:"", rent:"8000", dateJoining:"2024-08-09", dateLeaving:"", note:"6k from march", monthly:{ ...makeMonthly() } },
    { name:"Pranji", contact:"7460993597", deposit:"", rent:"7500", dateJoining:"2024-01-04", dateLeaving:"", note:"", monthly:{ ...makeMonthly(), January:{amount:"6000",halfFull:"Full",collector:"Vishnu",note:""}, February:{amount:"6000",halfFull:"Half",collector:"Vishnu",note:""} } },
    { name:"Monali Mehta", contact:"9773240787", deposit:"", rent:"4800", dateJoining:"2024-05-20", dateLeaving:"", note:"", monthly:{ ...makeMonthly(), January:{amount:"6000",halfFull:"Full",collector:"Vishnu",note:""} } },
    { name:"Hanee Vinobhai Patel", contact:"9879061117", deposit:"", rent:"7500", dateJoining:"2024-07-25", dateLeaving:"", note:"7500 rent from Feb month", monthly:{ ...makeMonthly(), January:{amount:"7500",halfFull:"Full",collector:"Vishnu",note:""} } },
    { name:"Mitangi Patel", contact:"8511270478", deposit:"", rent:"7500", dateJoining:"2024-07-25", dateLeaving:"", note:"", monthly:{ ...makeMonthly(), January:{amount:"7500",halfFull:"Full",collector:"Vishnu",note:""} } },
    { name:"Ankita prakash Biwas", contact:"8849740167", deposit:"6500", rent:"6500", dateJoining:"2025-01-02", dateLeaving:"", note:"", monthly:{ ...makeMonthly(), January:{amount:"5000",halfFull:"Full",collector:"Vishnu",note:""}, February:{amount:"5000",halfFull:"Half",collector:"Vishnu",note:""} } },
    { name:"kajal", contact:"9664836532", deposit:"", rent:"4300", dateJoining:"2024-12-09", dateLeaving:"", note:"", monthly:{ ...makeMonthly(), January:{amount:"4300",halfFull:"Full",collector:"Mahendra",note:""}, February:{amount:"2000",halfFull:"Half",collector:"Mahendra",note:""} } },
    { name:"srushti kumari", contact:"9883974249", deposit:"6000", rent:"6000", dateJoining:"2025-11-01", dateLeaving:"", note:"", monthly:{ ...makeMonthly(), January:{amount:"6000",halfFull:"Full",collector:"Vishnu",note:""}, February:{amount:"6000",halfFull:"Full",collector:"Vishnu",note:""} } },
    { name:"hemu rajput", contact:"83471 53068", deposit:"6500", rent:"6500", dateJoining:"2025-09-19", dateLeaving:"", note:"", monthly:makeMonthly() },
    { name:"rahula chandana", contact:"", deposit:"5000", rent:"8000", dateJoining:"2025-10-18", dateLeaving:"", note:"", monthly:{ ...makeMonthly(), January:{amount:"8000",halfFull:"Full",collector:"Vishnu",note:""} } },
    { name:"samiksha mallick", contact:"", deposit:"5200", rent:"5200", dateJoining:"2025-11-09", dateLeaving:"", note:"", monthly:{ ...makeMonthly(), January:{amount:"5200",halfFull:"Full",collector:"Vishnu",note:""}, February:{amount:"5200",halfFull:"Full",collector:"Vishnu",note:""} } },
    { name:"Jayswal shivangi .s", contact:"", deposit:"1000", rent:"5000", dateJoining:"2025-11-10", dateLeaving:"", note:"", monthly:{ ...makeMonthly(), January:{amount:"4500",halfFull:"Half",collector:"Vishnu",note:""} } },
    { name:"srusti devnath", contact:"", deposit:"5000", rent:"7000", dateJoining:"2025-12-06", dateLeaving:"", note:"", monthly:{ ...makeMonthly(), January:{amount:"7000",halfFull:"Full",collector:"Vishnu",note:""}, February:{amount:"7000",halfFull:"Full",collector:"Vishnu",note:""} } },
    { name:"kanishka singh", contact:"", deposit:"", rent:"7000", dateJoining:"2025-12-14", dateLeaving:"", note:"", monthly:{ ...makeMonthly(), January:{amount:"4000",halfFull:"Half",collector:"Mahendra",note:""} } },
    { name:"samiksha", contact:"", deposit:"", rent:"5200", dateJoining:"2026-01-03", dateLeaving:"", note:"", monthly:{ ...makeMonthly(), January:{amount:"5200",halfFull:"Half",collector:"Vishnu",note:""} } },
  ],
  Haridarshan: [
    { name:"siddhant gudecha", contact:"7505008000", deposit:"5500", rent:"5500", dateJoining:"2024-06-02", dateLeaving:"", note:"Rejoin in Sep", monthly:{ ...makeMonthly(), January:{amount:"5500",halfFull:"Full",collector:"Vishnu",note:""} } },
    { name:"Harmeet sing bhodye", contact:"8155895509", deposit:"4200", rent:"4200", dateJoining:"2024-09-21", dateLeaving:"", note:"", monthly:makeMonthly() },
    { name:"sumit chalake", contact:"8591902540", deposit:"4500", rent:"4500", dateJoining:"2024-10-02", dateLeaving:"", note:"", monthly:{ ...makeMonthly(), January:{amount:"4500",halfFull:"Full",collector:"Mahendra",note:""}, February:{amount:"4500",halfFull:"Full",collector:"Mahendra",note:""}, March:{amount:"4500",halfFull:"Full",collector:"Mahendra",note:""} } },
    { name:"Rahul pande", contact:"8668645981", deposit:"5000", rent:"5000", dateJoining:"2024-10-15", dateLeaving:"", note:"", monthly:{ ...makeMonthly(), January:{amount:"4500",halfFull:"Full",collector:"Mahendra",note:""}, February:{amount:"4500",halfFull:"Full",collector:"Mahendra",note:""} } },
    { name:"umang jindal", contact:"", deposit:"5500", rent:"5500", dateJoining:"2025-04-25", dateLeaving:"", note:"", monthly:{ ...makeMonthly(), January:{amount:"5000",halfFull:"Full",collector:"Vishnu",note:"5000 paid to vishal"} } },
    { name:"yashkumar surati", contact:"9879699673", deposit:"5200", rent:"5200", dateJoining:"2025-05-04", dateLeaving:"", note:"", monthly:{ ...makeMonthly(), January:{amount:"5200",halfFull:"Full",collector:"Vishnu",note:""}, February:{amount:"5200",halfFull:"Full",collector:"Vishnu",note:""} } },
    { name:"gaurav khasdev", contact:"8962152760", deposit:"5000", rent:"5000", dateJoining:"2025-06-08", dateLeaving:"", note:"", monthly:{ ...makeMonthly(), January:{amount:"5000",halfFull:"Full",collector:"Vishnu",note:""}, February:{amount:"5000",halfFull:"Full",collector:"Vishnu",note:""} } },
    { name:"dev patel", contact:"8128681296", deposit:"", rent:"5500", dateJoining:"2025-05-15", dateLeaving:"", note:"", monthly:{ ...makeMonthly(), January:{amount:"5500",halfFull:"Full",collector:"Vishnu",note:""}, February:{amount:"5500",halfFull:"Full",collector:"Vishnu",note:""} } },
    { name:"mustakin fri", contact:"", deposit:"5000", rent:"5000", dateJoining:"2025-06-19", dateLeaving:"", note:"", monthly:{ ...makeMonthly(), January:{amount:"5000",halfFull:"Full",collector:"Vishnu",note:""}, February:{amount:"5000",halfFull:"Full",collector:"Vishnu",note:""} } },
    { name:"baloch mustkin", contact:"9316471112", deposit:"5000", rent:"5000", dateJoining:"2025-08-03", dateLeaving:"", note:"", monthly:makeMonthly() },
    { name:"Varun Mishra", contact:"9510737325", deposit:"5000", rent:"5000", dateJoining:"2025-08-07", dateLeaving:"", note:"", monthly:{ ...makeMonthly(), January:{amount:"5000",halfFull:"Full",collector:"Vishnu",note:""}, February:{amount:"5000",halfFull:"Full",collector:"Vishnu",note:""} } },
    { name:"sudipo", contact:"", deposit:"4500", rent:"4500", dateJoining:"2025-12-19", dateLeaving:"", note:"", monthly:{ ...makeMonthly(), January:{amount:"4500",halfFull:"Full",collector:"Mahendra",note:""}, February:{amount:"4500",halfFull:"Full",collector:"Vishnu",note:""} } },
    { name:"wakar", contact:"", deposit:"", rent:"5500", dateJoining:"2026-01-10", dateLeaving:"", note:"", monthly:{ ...makeMonthly(), January:{amount:"5500",halfFull:"Half",collector:"Vishnu",note:""} } },
    { name:"thirh patel", contact:"", deposit:"5700", rent:"5300", dateJoining:"2026-01-06", dateLeaving:"", note:"", monthly:{ ...makeMonthly(), January:{amount:"10000",halfFull:"Full",collector:"Vishnu",note:"5700 paid to vishal"}, February:{amount:"2500",halfFull:"Half",collector:"Vishnu",note:""} } },
    { name:"niranjan morya", contact:"", deposit:"4500", rent:"4500", dateJoining:"2026-02-10", dateLeaving:"", note:"", monthly:{ ...makeMonthly(), February:{amount:"9000",halfFull:"Full",collector:"Vishnu",note:""} } },
  ],
  Shivneri: [
    { name:"Pinal Patel", contact:"9033583842", deposit:"3000+3000", rent:"6000", dateJoining:"2024-09-04", dateLeaving:"", note:"", monthly:{ ...makeMonthly(), January:{amount:"6000",halfFull:"Full",collector:"Vishnu",note:""}, February:{amount:"6000",halfFull:"Full",collector:"Vishnu",note:""} } },
    { name:"vikrant Nayak", contact:"7878785722", deposit:"4000", rent:"4000", dateJoining:"2025-01-01", dateLeaving:"", note:"", monthly:{ ...makeMonthly(), January:{amount:"4000",halfFull:"Full",collector:"Mahendra",note:""}, February:{amount:"4000",halfFull:"Full",collector:"Vishnu",note:""} } },
    { name:"Nishant Bhargava", contact:"9068289241", deposit:"4200", rent:"4200", dateJoining:"2025-02-01", dateLeaving:"", note:"", monthly:{ ...makeMonthly(), January:{amount:"4200",halfFull:"Full",collector:"Vishnu",note:""}, February:{amount:"4200",halfFull:"Full",collector:"Vishnu",note:""} } },
    { name:"harsh saraswat", contact:"9257024199", deposit:"6000", rent:"6000", dateJoining:"2025-05-23", dateLeaving:"", note:"", monthly:{ ...makeMonthly(), January:{amount:"6000",halfFull:"Full",collector:"Vishnu",note:""}, February:{amount:"6000",halfFull:"Full",collector:"Vishnu",note:""}, March:{amount:"6000",halfFull:"Full",collector:"Vishnu",note:""} } },
    { name:"bhagwan pagare", contact:"9766859367", deposit:"6000", rent:"6000", dateJoining:"2025-06-15", dateLeaving:"", note:"", monthly:{ ...makeMonthly(), January:{amount:"6000",halfFull:"Full",collector:"Vishnu",note:""}, February:{amount:"6000",halfFull:"Full",collector:"Vishnu",note:""} } },
    { name:"sachin jaat", contact:"", deposit:"6500", rent:"6500", dateJoining:"2025-11-05", dateLeaving:"", note:"", monthly:{ ...makeMonthly(), January:{amount:"6500",halfFull:"Full",collector:"Vishnu",note:""}, February:{amount:"8500",halfFull:"Full",collector:"Vishnu",note:""} } },
    { name:"ramesh purohit", contact:"7000123774", deposit:"7500", rent:"7500", dateJoining:"2025-12-01", dateLeaving:"", note:"", monthly:makeMonthly() },
    { name:"yash sevak", contact:"", deposit:"4200", rent:"4200", dateJoining:"2026-01-01", dateLeaving:"", note:"", monthly:{ ...makeMonthly(), January:{amount:"8400",halfFull:"Full",collector:"Vishnu",note:""}, February:{amount:"4200",halfFull:"Full",collector:"Vishnu",note:""} } },
    { name:"anuj patel", contact:"", deposit:"6000", rent:"6000", dateJoining:"2026-01-01", dateLeaving:"", note:"", monthly:{ ...makeMonthly(), January:{amount:"12000",halfFull:"Full",collector:"Vishnu",note:""}, February:{amount:"6000",halfFull:"Full",collector:"Vishnu",note:""} } },
    { name:"sahil parmar", contact:"", deposit:"5500", rent:"5500", dateJoining:"2026-01-26", dateLeaving:"", note:"", monthly:{ ...makeMonthly(), January:{amount:"5500",halfFull:"Half",collector:"Vishnu",note:""}, February:{amount:"11000",halfFull:"Full",collector:"Vishnu",note:""} } },
  ],
  Crystal: [
    { name:"Tikisha Umaria", contact:"8200643639", deposit:"6000", rent:"6000", dateJoining:"2025-01-07", dateLeaving:"", note:"", monthly:{ ...makeMonthly(), January:{amount:"6000",halfFull:"Full",collector:"Vishnu",note:""}, February:{amount:"6000",halfFull:"Full",collector:"Vishnu",note:""} } },
    { name:"snehal panchal", contact:"8780614184", deposit:"7500", rent:"7500", dateJoining:"2025-07-01", dateLeaving:"", note:"", monthly:{ ...makeMonthly(), January:{amount:"7500",halfFull:"Full",collector:"Vishnu",note:""}, February:{amount:"7500",halfFull:"Full",collector:"Mahendra",note:""} } },
    { name:"ankita", contact:"", deposit:"11000", rent:"16000", dateJoining:"2025-09-08", dateLeaving:"", note:"", monthly:{ ...makeMonthly(), January:{amount:"16000",halfFull:"Full",collector:"Vishnu",note:""}, February:{amount:"15100",halfFull:"Full",collector:"Cash/other",note:"Vaibhav 15K"} } },
    { name:"sui kamni", contact:"", deposit:"7500", rent:"7500", dateJoining:"2025-12-21", dateLeaving:"", note:"", monthly:{ ...makeMonthly(), January:{amount:"6500",halfFull:"Full",collector:"Vishnu",note:""}, February:{amount:"7500",halfFull:"Full",collector:"Vishnu",note:""} } },
    { name:"sakshi", contact:"", deposit:"7000", rent:"7000", dateJoining:"2026-01-01", dateLeaving:"", note:"", monthly:{ ...makeMonthly(), January:{amount:"7000",halfFull:"Half",collector:"Mahendra",note:""}, February:{amount:"14000",halfFull:"Full",collector:"Vishnu",note:""} } },
  ],
  Torna: [
    { name:"purvi chavhan", contact:"98791 25139", deposit:"5500", rent:"7000", dateJoining:"2025-07-15", dateLeaving:"", note:"", monthly:{ ...makeMonthly(), January:{amount:"5000",halfFull:"Full",collector:"Vishnu",note:""}, February:{amount:"5000",halfFull:"Full",collector:"Vishnu",note:""} } },
    { name:"roshni Shrivastava", contact:"9503264976", deposit:"5000", rent:"5000", dateJoining:"2025-08-01", dateLeaving:"", note:"", monthly:{ ...makeMonthly(), January:{amount:"5000",halfFull:"Full",collector:"Vishnu",note:""}, February:{amount:"5000",halfFull:"Full",collector:"Vishnu",note:""} } },
    { name:"kartika", contact:"", deposit:"8000", rent:"6000", dateJoining:"2025-08-01", dateLeaving:"", note:"", monthly:{ ...makeMonthly(), January:{amount:"6000",halfFull:"Full",collector:"Vishnu",note:""}, February:{amount:"6000",halfFull:"Full",collector:"Vishnu",note:""} } },
    { name:"Shruti Mishra", contact:"6003435071", deposit:"4000", rent:"8500", dateJoining:"2025-11-06", dateLeaving:"", note:"", monthly:{ ...makeMonthly(), January:{amount:"8500",halfFull:"Full",collector:"Vishnu",note:""}, February:{amount:"8500",halfFull:"Full",collector:"Vishnu",note:""} } },
    { name:"mansi", contact:"", deposit:"8000", rent:"8000", dateJoining:"2025-12-20", dateLeaving:"", note:"", monthly:{ ...makeMonthly(), January:{amount:"8000",halfFull:"Full",collector:"Vishnu",note:""}, February:{amount:"8000",halfFull:"Full",collector:"Vishnu",note:""} } },
  ],
  Rajgad: [
    { name:"Abhay Kukadiya", contact:"9687632784", deposit:"3000", rent:"6000", dateJoining:"2025-07-18", dateLeaving:"", note:"", monthly:makeMonthly() },
    { name:"nitya rathod", contact:"", deposit:"6100", rent:"6100", dateJoining:"2025-12-01", dateLeaving:"", note:"", monthly:{ ...makeMonthly(), January:{amount:"6100",halfFull:"Full",collector:"Vishnu",note:""}, February:{amount:"6100",halfFull:"Full",collector:"Vishnu",note:""} } },
    { name:"allan thomas", contact:"", deposit:"6500", rent:"6500", dateJoining:"2025-12-20", dateLeaving:"", note:"", monthly:{ ...makeMonthly(), January:{amount:"6500",halfFull:"Full",collector:"Vishnu",note:""} } },
    { name:"aryan patel", contact:"", deposit:"5500", rent:"5500", dateJoining:"2026-01-06", dateLeaving:"", note:"", monthly:{ ...makeMonthly(), January:{amount:"11000",halfFull:"Full",collector:"Mahendra",note:""}, February:{amount:"5500",halfFull:"Full",collector:"Vishnu",note:""} } },
    { name:"rahul addago", contact:"", deposit:"6000", rent:"6000", dateJoining:"2026-01-04", dateLeaving:"", note:"", monthly:{ ...makeMonthly(), January:{amount:"12000",halfFull:"Full",collector:"Vishnu",note:""}, February:{amount:"6000",halfFull:"Full",collector:"Vishnu",note:""} } },
  ],
  Heritage: [
    { name:"Samiya Naik", contact:"9702951432", deposit:"8000", rent:"8000", dateJoining:"2025-09-01", dateLeaving:"", note:"", monthly:{ ...makeMonthly(), January:{amount:"8000",halfFull:"Full",collector:"Vishnu",note:""}, February:{amount:"8000",halfFull:"Full",collector:"Vishnu",note:""}, March:{amount:"7700",halfFull:"Full",collector:"Vishnu",note:""} } },
    { name:"Kavya", contact:"8302588832", deposit:"13500", rent:"13500", dateJoining:"2025-09-01", dateLeaving:"", note:"", monthly:{ ...makeMonthly(), January:{amount:"13500",halfFull:"Full",collector:"Vishnu",note:""}, February:{amount:"13500",halfFull:"Full",collector:"Vishnu",note:""} } },
    { name:"anubarshi", contact:"7550229185", deposit:"7500", rent:"7500", dateJoining:"2025-10-08", dateLeaving:"", note:"", monthly:{ ...makeMonthly(), January:{amount:"7500",halfFull:"Full",collector:"Vishnu",note:""}, February:{amount:"7500",halfFull:"Full",collector:"Vishnu",note:""} } },
    { name:"sanika pawar", contact:"9322643376", deposit:"7000", rent:"6500", dateJoining:"2025-11-01", dateLeaving:"", note:"", monthly:{ ...makeMonthly(), January:{amount:"6500",halfFull:"Full",collector:"Vishnu",note:""}, February:{amount:"6500",halfFull:"Full",collector:"Vishnu",note:""}, March:{amount:"6500",halfFull:"Full",collector:"Vishnu",note:""} } },
    { name:"anjori", contact:"92271 76114", deposit:"4500", rent:"6500", dateJoining:"2025-11-15", dateLeaving:"", note:"", monthly:{ ...makeMonthly(), January:{amount:"6500",halfFull:"Full",collector:"Vishnu",note:""}, February:{amount:"9000",halfFull:"Full",collector:"Vishnu",note:""} } },
  ],
  UDAPI: [
    { name:"Aditya Bholane", contact:"", deposit:"", rent:"4000", dateJoining:"", dateLeaving:"", note:"", monthly:{ ...makeMonthly(), January:{amount:"4000",halfFull:"Half",collector:"Vishnu",note:""} } },
    { name:"manan", contact:"", deposit:"", rent:"5500", dateJoining:"", dateLeaving:"", note:"", monthly:{ ...makeMonthly(), January:{amount:"5500",halfFull:"Half",collector:"Vishnu",note:"vishal"} } },
    { name:"tejas", contact:"", deposit:"", rent:"5000", dateJoining:"", dateLeaving:"", note:"", monthly:{ ...makeMonthly(), January:{amount:"10000",halfFull:"Full",collector:"Vishnu",note:""} } },
  ],
  Shantiniketan: [
    { name:"Gaurav Nayi", contact:"6356735861", deposit:"4000", rent:"4000", dateJoining:"2025-03-04", dateLeaving:"", note:"", monthly:{ ...makeMonthly(), January:{amount:"4000",halfFull:"Full",collector:"Vishnu",note:""} } },
    { name:"niket mishra", contact:"7416475847", deposit:"6500", rent:"6500", dateJoining:"2025-06-16", dateLeaving:"", note:"", monthly:makeMonthly() },
    { name:"Sidhpura viral", contact:"7359576155", deposit:"4500", rent:"4500", dateJoining:"2025-03-17", dateLeaving:"", note:"Transfer to Shantiniketan", monthly:{ ...makeMonthly(), January:{amount:"4500",halfFull:"Full",collector:"Vishnu",note:""} } },
    { name:"Santosh kumar", contact:"", deposit:"5000", rent:"5000", dateJoining:"2025-11-01", dateLeaving:"", note:"", monthly:makeMonthly() },
  ],
};
