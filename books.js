export const BOOKS_DATA = [
    {
        id: 'kitap1',
        title: 'Karanfilsiz',
        author: 'Adalet Ağaoğlu',
        textSource: 'books/1.txt', 
        repeat: 1, 
        quiz: [
            { 
                question: "Metinde kahramanın geleneksel olarak yaptığı, dedesinden ve babasından kalan iş nedir?", 
                options: [
                    "A) Kamyon ve atlı araba kasalarını süsleyip boyamak", 
                    "B) Atölyede tabancayla hızlı kasa boyamak", 
                    "C) Ahşap kasa imalatı yapmak", 
                    "D) Manzara tabloları çizip satmak"
                ], 
                answer: "A) Kamyon ve atlı araba kasalarını süsleyip boyamak" 
            },
            { 
                question: "Kasa yapımında çalışan kaportacı arkadaşının, kahramanın yaptığı işe karşı tavrı nasıldır?", 
                options: [
                    "A) Sanatına hayranlık duymakta ve onu desteklemektedir.", 
                    "B) Yapılan işi yavaş, gereksiz bir süs ve çocukça bularak küçümsemektedir.", 
                    "C) Kendisi de bu işi öğrenmek için sabırla beklemektedir.", 
                    "D) Renklerin dengesini kaçırdığı için ona öfkelenmektedir."
                ], 
                answer: "B) Yapılan işi yavaş, gereksiz bir süs ve çocukça bularak küçümsemektedir." 
            },
            { 
                question: "Kaportacının 'Erkek işi!' diyerek övdüğü ve kahramanın aklını çelen yeni boyama yöntemi aşağıdakilerden hangisidir?", 
                options: [
                    "A) Fırçayla daha iri ve belirgin karanfiller çizmek", 
                    "B) Yapılan işi yavaş, gereksiz bir süs ve çocukça bularak küçümsemektedir.", 
                    "C) Atölyede tabanca ile tek renk boyayı hızlıca sıkmak", 
                    "D) Kasayı boyamadan sadece cilalamak"
                ], 
                answer: "C) Atölyede tabanca ile tek renk boyayı hızlıca sıkmak" 
            }
        ]
    },
    {
        id: 'kitap2',
        title: 'Falaka',
        author: 'Ömer Seyfettin',
        textSource: 'books/2.txt',
        repeat: 1, 
        quiz: [
            { 
                question: "Kaymakam Bey mektebe ilk ziyaretinde falakayı yasakladıktan sonra, kırk çocuğun Hoca Efendi’ye karşı takındığı tavır nasıl değişmiştir?", 
                options: [
                    "A) Korkudan daha çok ders çalışmaya başlamışlardır.", 
                    "B) Hoca Efendi'ye acıyıp ona yardım etmişlerdir.", 
                    "C) Dayak korkusu kalktığı için hocaya çeşitli şakalar yapıp onu dinlememişlerdir.", 
                    "D) Mektebi tamamen bırakıp Gönen'e geri dönmüşlerdir."
                ], 
                answer: "C) Dayak korkusu kalktığı için hocaya çeşitli şakalar yapıp onu dinlememişlerdir." 
            },            
            { 
                question: "Hoca Efendi’nin, 'Kim hapşırırsa şart olsun öldürünceye kadar döveceğim!' diyerek ettiği yeminin evdeki karşılığını öğrenen çocuklar, bu yeminin bozulması durumunda ne olacağını düşünmektedir?", 
                options: [
                    "A) Yalan söyleyenin çarpılacağını", 
                    "B) Hoca Efendi'nin karısının boş düşeceğini", 
                    "C) Mektebin kaymakam tarafından kapatılacağını", 
                    "D) Abdurrahman Çelebi'nin öleceğini"
                ], 
                answer: "B) Hoca Efendi'nin karısının boş düşeceğini" 
            },
            { 
                question: "Hikayenin anlatıcısı (başkarakter), Abdurrahman Çelebi'nin durmadan hapşırmasını sağlamak için nasıl bir muziplik yapmıştır?", 
                options: [
                    "A) Eşeğin burnuna kağıt boruyla enfiye üflemiştir.", 
                    "B) Eşeğe bilerek bozuk ve tozlu otlar yedirmiştir.", 
                    "C) Eşeği soğukta abdestlik sundurmasının altında bırakmıştır.", 
                    "D) Eşeğin yüzüne leblebi fırlatmıştır."
                ], 
                answer: "A) Eşeğin burnuna kağıt boruyla enfiye üflemiştir." 
            }
        ]
    },
    {
        id: 'kitap3',
        title: 'Dülger Balığının Ölümü',
        author: 'Sait Faik Abasıyanık',
        textSource: 'books/3.txt',
        repeat: 1, 
        quiz: [
            { 
                question: "Metne göre Rum balıkçıların 'Hristos balığı' dedikleri dülger balığının, Hz. İsa onunla konuşmadan önceki ilk çağlardaki durumu nasıldır?", 
                options: [
                    "A) Akdeniz'de korsanların bile adını duyunca bembeyaz kesildiği, gemileri deviren korkunç bir deniz canavarıdır.", 
                    "B) Denizlerin dibinde kendi halinde yaşayan, pulları mücevher değerinde süslü bir balıktır.", 
                    "C) Oltaya takıldığı an sulara küsen, dakikalarca feryat eden çok korkak bir yaratıktır.", 
                    "D) Balıkçıların sandallarına eşlik eden, insan dostu uysal bir hayvandır."
                ], 
                answer: "A) Akdeniz'de korsanların bile adını duyunca bembeyaz kesildiği, gemileri deviren korkunç bir deniz canavarıdır." 
            },
            { 
                question: "Anlatıcının akasya dalına asılmış bir dülger balığında gördüğü, ilk bakışta eğlenceli görünen ama gerçekte bir 'ölüm dansı' olan harikulade olay aşağıdakilerden hangisidir?", 
                options: [
                    "A) Balığın sudan çıkar çıkmaz naylon gibi şeffaf ağzını bir karış açması.", 
                    "B) Balığın vücudundaki çivi ve testereye benzeyen kemiksi dikenleri sertçe oynatması.", 
                    "C) Aletlerinin etrafını çeviren ipekten yumuşak incecik zarlarının zevkli bir ürperişle tatlı tatlı titremesi.", 
                    "D) Balığın oltadan kurtulmak için havada yamyassı serilerek taklalar atması."
                ], 
                answer: "C) Aletlerinin etrafını çeviren ipekten yumuşak incecik zarlarının zevkli bir ürperişle tatlı tatlı titremesi." 
            },
            { 
                question: "Yazarın hikayenin sonunda yaptığı insanlık eleştirisine göre; dülger balığı eğer bizim atmosferimize (hava dünyamıza) alışabilseydi insanoğlu ona ne yapardı?", 
                options: [
                    "A) Onun uysal, sakin ve hassas huyuna saygı duyup onu baş tacı ederdi.", 
                    "B) Önce onu hassaslığı ve küskünlüğü yüzünden kötüleyip canından bezdirir; sonunda onu içindeki tüm güzellikleri söküp atmış eski bir canavara dönüştürürdü.", 
                    "C) Onu evcilleştirip denizlerdeki diğer zararlı yaratıklara karşı bir koruyucu olarak kullanırdı.", 
                    "D) Yanar döner pullarını bayanların balolarda giymesi için lüks elbiselerin yapımında kullanırdı."
                ], 
                answer: "B) Önce onu hassaslığı ve küskünlüğü yüzünden kötüleyip canından bezdirir; sonunda onu içindeki tüm güzellikleri söküp atmış eski bir canavara dönüştürürdü." 
            }
        ]
    }
];
