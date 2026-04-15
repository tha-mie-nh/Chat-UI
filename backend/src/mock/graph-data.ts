// Mock graph data — simulates output from a backend graph-search agent.
// ── SWAP GUIDE ──────────────────────────────────────────────────────────────
// When real agent is ready, delete this file and update graph-interpreter.ts:
//   getGraphData() → fetch(AGENT_URL, { method:'POST', body:JSON.stringify({query}) })
// ────────────────────────────────────────────────────────────────────────────

export interface AppearanceFeatures {
  age_range: '20-30' | '30-40' | '40-50' | '50-60';
  skin_tone: 'sáng' | 'trung bình' | 'tối';
  hair_color: 'đen' | 'nâu' | 'xám';
  hair_style: 'ngắn' | 'dài' | 'xoăn';
  glasses: boolean;
  facial_hair: boolean; // relevant for male; false for female
}

export interface GraphNode {
  id: string; name: string; job: string; age: number; gender: 'Nam' | 'Nữ';
  city: string; district: string; province: string; education: string;
  workplace: string; income_level: 'thấp' | 'trung bình' | 'khá' | 'cao';
  marital_status: 'độc thân' | 'đã kết hôn' | 'ly hôn' | 'góa';
  birth_year: number; nationality: string; religion: string; ethnic_group: string;
  phone_prefix: string; has_children: boolean; created_at: string; confidence_score: number;
  appearance: AppearanceFeatures;
}

export interface GraphEdge {
  id: string; from: string; to: string;
  type: 'vợ chồng' | 'anh em' | 'đồng nghiệp' | 'bạn bè' | 'họ hàng';
  // weight: number; confidence: number; created_at: string; // [REMOVED] — không cần cho LLM interpretation
}

export interface GraphData { nodes: GraphNode[]; edges: GraphEdge[]; }

export const ALL_NODES: GraphNode[] = [
  // ── Nguyễn Văn A — công chức, 10 tỉnh thành ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
  { id:'a1',  name:'Nguyễn Văn A', job:'công chức', age:35, gender:'Nam', city:'Hà Nội',        district:'Hoàn Kiếm',    province:'Hà Nội',         education:'Đại học',        workplace:'UBND Quận Hoàn Kiếm',              income_level:'trung bình', marital_status:'đã kết hôn', birth_year:1991, nationality:'Việt Nam', religion:'Không', ethnic_group:'Kinh', phone_prefix:'024',  has_children:true,  created_at:'2024-01-15', confidence_score:0.92, appearance:{ age_range:'30-40', skin_tone:'trung bình', hair_color:'đen', hair_style:'ngắn', glasses:false, facial_hair:false } },
  { id:'a2',  name:'Nguyễn Văn A', job:'công chức', age:42, gender:'Nam', city:'Hồ Chí Minh',   district:'Bình Thạnh',   province:'TP.HCM',         education:'Thạc sĩ',        workplace:'Sở Tài chính TP.HCM',              income_level:'cao',        marital_status:'đã kết hôn', birth_year:1984, nationality:'Việt Nam', religion:'Phật',  ethnic_group:'Kinh', phone_prefix:'028',  has_children:true,  created_at:'2024-02-10', confidence_score:0.88, appearance:{ age_range:'40-50', skin_tone:'sáng',      hair_color:'đen', hair_style:'ngắn', glasses:true,  facial_hair:false } },
  { id:'a3',  name:'Nguyễn Văn A', job:'công chức', age:28, gender:'Nam', city:'Đà Nẵng',       district:'Hải Châu',     province:'Đà Nẵng',        education:'Đại học',        workplace:'UBND Quận Hải Châu',               income_level:'trung bình', marital_status:'độc thân',   birth_year:1998, nationality:'Việt Nam', religion:'Không', ethnic_group:'Kinh', phone_prefix:'0236', has_children:false, created_at:'2024-03-05', confidence_score:0.85, appearance:{ age_range:'20-30', skin_tone:'trung bình', hair_color:'đen', hair_style:'ngắn', glasses:false, facial_hair:false } },
  { id:'a4',  name:'Nguyễn Văn A', job:'công chức', age:51, gender:'Nam', city:'Hải Phòng',     district:'Lê Chân',      province:'Hải Phòng',      education:'Đại học',        workplace:'Sở Nội vụ Hải Phòng',              income_level:'trung bình', marital_status:'đã kết hôn', birth_year:1975, nationality:'Việt Nam', religion:'Không', ethnic_group:'Kinh', phone_prefix:'0225', has_children:true,  created_at:'2024-01-20', confidence_score:0.79, appearance:{ age_range:'50-60', skin_tone:'tối',        hair_color:'xám', hair_style:'ngắn', glasses:true,  facial_hair:true  } },
  { id:'a5',  name:'Nguyễn Văn A', job:'công chức', age:33, gender:'Nam', city:'Cần Thơ',       district:'Ninh Kiều',    province:'Cần Thơ',        education:'Đại học',        workplace:'UBND TP. Cần Thơ',                 income_level:'trung bình', marital_status:'đã kết hôn', birth_year:1993, nationality:'Việt Nam', religion:'Không', ethnic_group:'Kinh', phone_prefix:'0292', has_children:false, created_at:'2024-04-12', confidence_score:0.91, appearance:{ age_range:'30-40', skin_tone:'tối',        hair_color:'đen', hair_style:'ngắn', glasses:false, facial_hair:true  } },
  { id:'a6',  name:'Nguyễn Văn A', job:'công chức', age:45, gender:'Nam', city:'Huế',           district:'Phú Hội',      province:'Thừa Thiên Huế', education:'Thạc sĩ',        workplace:'UBND Tỉnh Thừa Thiên Huế',         income_level:'cao',        marital_status:'đã kết hôn', birth_year:1981, nationality:'Việt Nam', religion:'Phật',  ethnic_group:'Kinh', phone_prefix:'0234', has_children:true,  created_at:'2024-02-28', confidence_score:0.87, appearance:{ age_range:'40-50', skin_tone:'sáng',      hair_color:'đen', hair_style:'ngắn', glasses:true,  facial_hair:false } },
  { id:'a7',  name:'Nguyễn Văn A', job:'công chức', age:38, gender:'Nam', city:'Nha Trang',     district:'Vĩnh Hải',     province:'Khánh Hòa',      education:'Đại học',        workplace:'Sở Kế hoạch và Đầu tư Khánh Hòa', income_level:'trung bình', marital_status:'ly hôn',     birth_year:1988, nationality:'Việt Nam', religion:'Không', ethnic_group:'Kinh', phone_prefix:'0258', has_children:true,  created_at:'2024-05-01', confidence_score:0.82, appearance:{ age_range:'30-40', skin_tone:'tối',        hair_color:'đen', hair_style:'ngắn', glasses:false, facial_hair:true  } },
  { id:'a8',  name:'Nguyễn Văn A', job:'công chức', age:29, gender:'Nam', city:'Vinh',          district:'Hưng Dũng',    province:'Nghệ An',        education:'Đại học',        workplace:'UBND TP. Vinh',                    income_level:'thấp',       marital_status:'độc thân',   birth_year:1997, nationality:'Việt Nam', religion:'Không', ethnic_group:'Kinh', phone_prefix:'0238', has_children:false, created_at:'2024-06-15', confidence_score:0.76, appearance:{ age_range:'20-30', skin_tone:'trung bình', hair_color:'đen', hair_style:'ngắn', glasses:false, facial_hair:false } },
  { id:'a9',  name:'Nguyễn Văn A', job:'công chức', age:55, gender:'Nam', city:'Buôn Ma Thuột', district:'Tân Lợi',      province:'Đắk Lắk',        education:'Đại học',        workplace:'Sở Giáo dục Đắk Lắk',             income_level:'trung bình', marital_status:'đã kết hôn', birth_year:1971, nationality:'Việt Nam', religion:'Không', ethnic_group:'Kinh', phone_prefix:'0262', has_children:true,  created_at:'2024-01-08', confidence_score:0.83, appearance:{ age_range:'50-60', skin_tone:'tối',        hair_color:'xám', hair_style:'ngắn', glasses:true,  facial_hair:true  } },
  { id:'a10', name:'Nguyễn Văn A', job:'công chức', age:31, gender:'Nam', city:'Thái Nguyên',   district:'Đồng Quang',   province:'Thái Nguyên',    education:'Đại học',        workplace:'UBND TP. Thái Nguyên',             income_level:'thấp',       marital_status:'đã kết hôn', birth_year:1995, nationality:'Việt Nam', religion:'Không', ethnic_group:'Kinh', phone_prefix:'0208', has_children:false, created_at:'2024-03-22', confidence_score:0.80, appearance:{ age_range:'30-40', skin_tone:'trung bình', hair_color:'đen', hair_style:'ngắn', glasses:false, facial_hair:false } },
  // ── Nguyễn Văn B — các nghề khác nhau ────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
  { id:'b1',  name:'Nguyễn Văn B', job:'kỹ sư xây dựng', age:40, gender:'Nam', city:'Hà Nội',      district:'Cầu Giấy',     province:'Hà Nội', education:'Đại học Xây dựng', workplace:'Công ty Xây dựng Hòa Bình', income_level:'cao',  marital_status:'đã kết hôn', birth_year:1986, nationality:'Việt Nam', religion:'Không', ethnic_group:'Kinh', phone_prefix:'024',  has_children:true,  created_at:'2024-02-14', confidence_score:0.90, appearance:{ age_range:'40-50', skin_tone:'sáng',      hair_color:'đen', hair_style:'ngắn', glasses:false, facial_hair:true  } },
  { id:'b2',  name:'Nguyễn Văn B', job:'bác sĩ',          age:47, gender:'Nam', city:'Hồ Chí Minh', district:'Quận 1',       province:'TP.HCM', education:'Tiến sĩ Y khoa',   workplace:'Bệnh viện Chợ Rẫy',         income_level:'cao',  marital_status:'đã kết hôn', birth_year:1979, nationality:'Việt Nam', religion:'Không', ethnic_group:'Kinh', phone_prefix:'028',  has_children:true,  created_at:'2024-01-30', confidence_score:0.95, appearance:{ age_range:'40-50', skin_tone:'trung bình', hair_color:'đen', hair_style:'ngắn', glasses:true,  facial_hair:false } },
  { id:'b3',  name:'Nguyễn Văn B', job:'giáo viên',       age:36, gender:'Nam', city:'Đà Nẵng',     district:'Ngũ Hành Sơn', province:'Đà Nẵng', education:'ĐH Sư phạm',      workplace:'THPT Nguyễn Hiền',          income_level:'thấp', marital_status:'đã kết hôn', birth_year:1990, nationality:'Việt Nam', religion:'Không', ethnic_group:'Kinh', phone_prefix:'0236', has_children:true,  created_at:'2024-04-05', confidence_score:0.88, appearance:{ age_range:'30-40', skin_tone:'trung bình', hair_color:'nâu', hair_style:'ngắn', glasses:false, facial_hair:false } },
  { id:'b4',  name:'Nguyễn Văn B', job:'lập trình viên',  age:27, gender:'Nam', city:'Hà Nội',      district:'Thanh Xuân',   province:'Hà Nội', education:'ĐH Công nghệ',     workplace:'FPT Software',               income_level:'cao',  marital_status:'độc thân',   birth_year:1999, nationality:'Việt Nam', religion:'Không', ethnic_group:'Kinh', phone_prefix:'024',  has_children:false, created_at:'2024-05-20', confidence_score:0.93, appearance:{ age_range:'20-30', skin_tone:'sáng',      hair_color:'đen', hair_style:'xoăn', glasses:false, facial_hair:false } },
  { id:'b5',  name:'Nguyễn Văn B', job:'luật sư',         age:44, gender:'Nam', city:'Hồ Chí Minh', district:'Quận 3',       province:'TP.HCM', education:'ĐH Luật',          workplace:'VP Luật Sư Hùng Phát',       income_level:'cao',  marital_status:'đã kết hôn', birth_year:1982, nationality:'Việt Nam', religion:'Không', ethnic_group:'Kinh', phone_prefix:'028',  has_children:true,  created_at:'2024-03-18', confidence_score:0.86, appearance:{ age_range:'40-50', skin_tone:'sáng',      hair_color:'đen', hair_style:'ngắn', glasses:true,  facial_hair:true  } },
  // ── Trần Thị C ────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
  { id:'c1',  name:'Trần Thị C', job:'kế toán',            age:32, gender:'Nữ', city:'Hà Nội',      district:'Đống Đa',      province:'Hà Nội', education:'ĐH Kinh tế',       workplace:'Công ty Xây dựng Hòa Bình',  income_level:'trung bình', marital_status:'đã kết hôn', birth_year:1994, nationality:'Việt Nam', religion:'Không', ethnic_group:'Kinh', phone_prefix:'024',  has_children:false, created_at:'2024-02-14', confidence_score:0.91, appearance:{ age_range:'30-40', skin_tone:'sáng',      hair_color:'đen', hair_style:'dài',  glasses:false, facial_hair:false } },
  { id:'c2',  name:'Trần Thị C', job:'giáo viên',          age:38, gender:'Nữ', city:'Hồ Chí Minh', district:'Bình Chánh',   province:'TP.HCM', education:'ĐH Sư phạm',      workplace:'Trường Tiểu học Bình Chánh', income_level:'thấp',       marital_status:'đã kết hôn', birth_year:1988, nationality:'Việt Nam', religion:'Phật',  ethnic_group:'Kinh', phone_prefix:'028',  has_children:true,  created_at:'2024-01-25', confidence_score:0.89, appearance:{ age_range:'30-40', skin_tone:'trung bình', hair_color:'đen', hair_style:'dài',  glasses:false, facial_hair:false } },
  { id:'c3',  name:'Trần Thị C', job:'y tá',               age:30, gender:'Nữ', city:'Đà Nẵng',     district:'Thanh Khê',    province:'Đà Nẵng', education:'Cao đẳng Y',      workplace:'Bệnh viện C Đà Nẵng',        income_level:'thấp',       marital_status:'độc thân',   birth_year:1996, nationality:'Việt Nam', religion:'Không', ethnic_group:'Kinh', phone_prefix:'0236', has_children:false, created_at:'2024-06-01', confidence_score:0.84, appearance:{ age_range:'20-30', skin_tone:'sáng',      hair_color:'đen', hair_style:'dài',  glasses:true,  facial_hair:false } },
  { id:'c4',  name:'Trần Thị C', job:'công chức',          age:43, gender:'Nữ', city:'Hải Phòng',   district:'Ngô Quyền',    province:'Hải Phòng', education:'Đại học',       workplace:'Sở Tư pháp Hải Phòng',       income_level:'trung bình', marital_status:'đã kết hôn', birth_year:1983, nationality:'Việt Nam', religion:'Không', ethnic_group:'Kinh', phone_prefix:'0225', has_children:true,  created_at:'2024-03-30', confidence_score:0.87, appearance:{ age_range:'40-50', skin_tone:'trung bình', hair_color:'nâu', hair_style:'ngắn', glasses:false, facial_hair:false } },
  { id:'c5',  name:'Trần Thị C', job:'nhân viên bán hàng', age:25, gender:'Nữ', city:'Cần Thơ',     district:'Cái Răng',     province:'Cần Thơ', education:'Cao đẳng',        workplace:'Siêu thị Co.opmart Cần Thơ', income_level:'thấp',       marital_status:'độc thân',   birth_year:2001, nationality:'Việt Nam', religion:'Không', ethnic_group:'Kinh', phone_prefix:'0292', has_children:false, created_at:'2024-05-10', confidence_score:0.78, appearance:{ age_range:'20-30', skin_tone:'sáng',      hair_color:'đen', hair_style:'xoăn', glasses:false, facial_hair:false } },
];

export const ALL_EDGES: GraphEdge[] = [
  { id:'e1',  from:'b1', to:'c1',  type:'vợ chồng'   },
  { id:'e2',  from:'a1', to:'b4',  type:'đồng nghiệp' },
  { id:'e3',  from:'a2', to:'b2',  type:'đồng nghiệp' },
  { id:'e4',  from:'a3', to:'c3',  type:'bạn bè'      },
  { id:'e5',  from:'b3', to:'c2',  type:'anh em'      },
  { id:'e6',  from:'a4', to:'a5',  type:'họ hàng'     },
  { id:'e7',  from:'b5', to:'c1',  type:'bạn bè'      },
  { id:'e8',  from:'a1', to:'c4',  type:'họ hàng'     },
  { id:'e9',  from:'b1', to:'b4',  type:'bạn bè'      },
  { id:'e10', from:'a6', to:'c3',  type:'đồng nghiệp' },
  { id:'e11', from:'b2', to:'c2',  type:'bạn bè'      },
  { id:'e12', from:'a9', to:'a10', type:'họ hàng'     },
];
