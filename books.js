export const BOOKS_DATA = [
    {
        id: 'kitap1',
        title: 'Karanfilsiz',
        author: 'Adalet Ağaoğlu',
        textSource: 'books/1.txt', 
        repeat: 1, 
        quiz: [
            { question: "Kitap 1'in ilk sorusu (Değiştirilebilir)", options: ["Cevap A", "Cevap B", "Doğru Cevap"], answer: "Doğru Cevap" },
            { question: "Kitap 1'in ikinci sorusu (Değiştirilebilir)", options: ["Yanlış", "Doğru"], answer: "Doğru" }
        ]
    },
    {
        id: 'kitap2',
        title: 'Falaka',
        author: 'Ömer Seyfettin',
        textSource: 'books/2.txt',
        repeat: 1, 
        quiz: [
            { question: "Kitap 2: Bu metin hakkında ne biliyorsun?", options: ["Hiçbir şey", "Tanımsız dolgu metin", "Tarihi eser"], answer: "Tanımsız dolgu metin" },
        ]
    },
    {
        id: 'kitap3',
        title: 'Dülger Balığının Ölümü',
        author: 'Sait Faik Abasıyanık',
        textSource: 'books/3.txt',
        repeat: 1, 
        quiz: []
    }
];