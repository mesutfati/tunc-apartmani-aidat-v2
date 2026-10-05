export const provinces = [
  'Adana','Adıyaman','Afyonkarahisar','Ağrı','Aksaray','Amasya','Ankara','Antalya','Ardahan','Artvin','Aydın','Balıkesir','Bartın','Batman','Bayburt','Bilecik','Bingöl','Bitlis','Bolu','Burdur','Bursa','Çanakkale','Çankırı','Çorum','Denizli','Diyarbakır','Düzce','Edirne','Elazığ','Erzincan','Erzurum','Eskişehir','Gaziantep','Giresun','Gümüşhane','Hakkari','Hatay','Iğdır','Isparta','İstanbul','İzmir','Kahramanmaraş','Karabük','Karaman','Kars','Kastamonu','Kayseri','Kilis','Kırıkkale','Kırklareli','Kırşehir','Kocaeli','Konya','Kütahya','Malatya','Manisa','Mardin','Mersin','Muğla','Muş','Nevşehir','Niğde','Ordu','Osmaniye','Rize','Sakarya','Samsun','Siirt','Sinop','Sivas','Şanlıurfa','Şırnak','Tekirdağ','Tokat','Trabzon','Tunceli','Uşak','Van','Yalova','Yozgat','Zonguldak'
];

export const districts = [
  { name:'Adalar' }, { name:'Arnavutköy' }, { name:'Ataşehir' }, { name:'Avcılar' }, { name:'Bağcılar' },
  { name:'Bahçelievler' }, { name:'Bakırköy' }, { name:'Başakşehir' }, { name:'Bayrampaşa' }, { name:'Beşiktaş' },
  { name:'Beykoz' }, { name:'Beylikdüzü' }, { name:'Beyoğlu' }, { name:'Büyükçekmece' }, { name:'Çatalca' },
  { name:'Çekmeköy' }, { name:'Esenler' }, { name:'Esenyurt' }, { name:'Eyüpsultan' }, { name:'Fatih' },
  { name:'Gaziosmanpaşa' }, { name:'Güngören' }, { name:'Kadıköy' }, { name:'Kağıthane' }, { name:'Kartal' },
  { name:'Küçükçekmece' }, { name:'Maltepe' }, { name:'Pendik' }, { name:'Sancaktepe' }, { name:'Sarıyer' },
  { name:'Silivri' }, { name:'Sultanbeyli' }, { name:'Sultangazi' }, { name:'Şile' }, { name:'Şişli' },
  { name:'Tuzla' }, { name:'Ümraniye' }, { name:'Üsküdar' }, { name:'Zeytinburnu' },
];

export const seedState = {
  view:'home',
  fuelType:'benzin',
  location:{ city:'İstanbul', district:'Kadıköy' },
  locationAccess:{ status:'unknown', permission:'prompt', serviceEnabled:null, checkedAt:null, message:'' },
  favorites:['Kadıköy', 'Beşiktaş'],
  pricesOnlyFavorites:false,
  gps:true,
  notificationTab:'current',
  priceSnapshots:{},
  earlyWarningHistory:{},
  vehicleTab:'vehicles',
  selectedVehicleId:null,
  vehicles:[],
  drivers:[],
  user:{ loggedIn:false, name:'', email:'' },
  trips:[],
  activeTrip:null,
  parks:[],
  emergencies:[],
  accidents:[],
  insurance:[],
  maintenance:[],
  receipts:[],
  healthSnapshot:null,
  healthReport:null,
  obdDevice:null,
  hgs:[],
  settings:{ notifications:true, autoBackup:false, motionTracking:false, mileage:0, locationPromptSeen:false },
  notifications:[]
};

export const fuelLabels = { benzin:'Benzin', motorin:'Motorin', lpg:'LPG' };
