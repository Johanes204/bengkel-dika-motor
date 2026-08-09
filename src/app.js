document.addEventListener('alpine:init', () => {
        Alpine.data('products', () => ({
        items: [],
        detailedItem: {},
        async init() {
            try {
                const response = await fetch('http://localhost:3000/products');
                const data = await response.json();


                // mapping nama kolom sesuai dari database
                this.items = data.map(product => ({
                    id: product.id_product,
                    id_product: product.id_product,
                    name: product.name_product,
                    img: product.img_product, // sudah `/img/produk-oli/nama.jpg`
                    detail: product.detail_product,
                    price: product.price_product
                }));

            } catch (err) {
                console.error('Gagal memuat produk:', err);
            }
        }
    }));

    Alpine.store('modal', {
        show: false,
        item: {},

        open(product) {
            this.item = product;
            this.show = true;
        },
        close() {
            this.show = false;
            this.item = {};
        }
    });

    Alpine.store('cart', {
        items: [],
        total: 0,
        quantity: 0,
        modalOpen: false,
        detailedItem: {},
        add(newItem) {
            // cek barang yang sama ada tidak
            const cartItem = this.items.find((item) => item.id === newItem.id);

            // jika belum ada
            if(!cartItem) {
                this.items.push({
                ...newItem,
                quantity: 1,
                total: newItem.price,
                id_product: newItem.id_product ?? newItem.id
            });
                this.quantity++;
                this.total += newItem.price;
            } else {
                // jika barang sudah ada, cek apakah barang beda atau sama dengan yang ada di cart
                this.items = this.items.map((item) => {
                    // jika barang berbeda
                    if(item.id !== newItem.id) {
                        return item;
                    }else {
                        // jika barang sudah ada
                        item.quantity++;
                        item.total = item.price * item.quantity;
                        this.quantity++;
                        this.total += item.price;
                        return item;
                    }
                });
            }
        },
        showModal(item) {
            this.detailedItem = item;
            this.modalOpen = true;
            // alert(JSON.stringify(item, null, 2));
            const itemDetailModal = document.querySelector('#item-detail-modal');
            document.querySelector('.detailed_detail').innerHTML = item.detail;
            document.querySelector('.detailed_price').innerHTML = rupiah(item.price);
            document.querySelector('.detailed_img').src = 'http://localhost:3000/img/produk-oli/' + item.img;
            itemDetailModal.classList.add('active');
        },
        hideModal() {
            this.modalOpen = false;
            this.detailedItem = {};
            const itemDetailModal = document.querySelector('#item-detail-modal');
            itemDetailModal.classList.remove('active');
        },
        remove(id) {
            // ambil item yang ingin diremove berdasarkan ID
            const cartItem = this.items.find((item) => item.id === id);

            // jika item lebih dari 1
            if(cartItem.quantity > 1) {
                // tulusuri 1 1
                this.items = this.items.map((item) => {
                    // jika bukan barang yang di klik
                    if(item.id !== id){
                        return item;
                    }else {
                        item.quantity--;
                        item.total = item.price * item.quantity;
                        this.quantity--;
                        this.total -= item.price;
                        return item;
                    }
                })
            } else if (cartItem.quantity === 1) {
                // jika barangnya sisa 1
                this.items = this.items.filter((item) => item.id !== id);
                this.quantity--;
                this.total -= cartItem.price;
            }
        }
    });
});


// form validasi
console.log(document.querySelector('.checkout-button'))
const checkoutButton =  document.querySelector('.checkout-button');
checkoutButton.disabled = true;

const form = document.querySelector('#checkout-form')

form.addEventListener('keyup', function() {
    for(let i = 0; i < form.elements.length; i++) {
        if(form.elements[i].value.length !== 0){
            checkoutButton.classList.remove('disabled');
            checkoutButton.classList.add('disabled');
        }else {
            return false;
        }
    }
    checkoutButton.disabled = false;
    checkoutButton.classList.remove('disabled');
});

// konversi ke rupiah
var rupiah = (number) => {
    return new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        minimumFractionDigits: 0
    }).format(number);
};

// kirim data ketika tombol checkout di klik
async function loadCustomers() {
    try {
        const response = await fetch('http://localhost:3000/customers');
        const customers = await response.json();
        console.log('Data customer:', customers);
    } catch (err) {
        console.error('Gagal memuat data pelanggan:', err);
    }
}

document.getElementById('checkout-form').addEventListener('submit', async function (e) {
    e.preventDefault();

    const formData = new FormData(this);
    const customer = {
        name_customer: formData.get('name'),
        phone_customer: formData.get('phone'),
        address_customer: formData.get('address'),
    };

    const items = Alpine.store('cart').items;
    const total_transactions = Alpine.store('cart').total;

    const payload = {
        customer,
        items,
        total_transactions
    };

    try {
        // Kirim ke backend terlebih dahulu
        const response = await fetch('http://localhost:3000/addTransaction', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const result = await response.json();

        if (response.ok) {
            console.log('Transaksi berhasil:', result);

            // Setelah tersimpan, baru redirect ke WhatsApp
            const message = formatMessage({
                ...customer,
                items,
                total: total_transactions
            });

            window.open('https://wa.me/6282169617698?text=' + encodeURIComponent(message));
            alert('Checkout berhasil dan data sudah dikirim!');
        } else {
            alert('Gagal simpan transaksi ke server');
            console.error('Error dari server:', result);
        }
    } catch (err) {
        console.error('Gagal kirim data ke backend:', err);
        alert('Terjadi kesalahan saat mengirim data');
    }
});

// format pesan whatsapp
function rupiah(number) {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(Number(number) || 0);
}

const formatMessage = (obj) => {
    let items = [];
    console.log("Objek yang diterima");
    console.log(obj)
    try {
        if (Array.isArray(obj.items)) {
            items = obj.items;
        } else if (typeof obj.items === 'string') {
            items = JSON.parse(obj.items);
        }
    } catch (e) {
        console.error("Gagal parse items:", e);
    }

    const itemLines = Array.isArray(obj.items) && items.length > 0
        ? items.map(item => {
            const quantity = item.quantity || 0;
            const total = item.total || (item.price * quantity) || 0;
            return `${item.name} (${quantity} x ${rupiah(total)})`;
        }).join('\n')
        : 'Tidak ada pesanan';

    return `Data Customer
Nama : ${obj.name_customer}
No Hp: ${obj.phone_customer} 
Alamat : ${obj.address_customer}

Data Pesanan:
${itemLines}
TOTAL: ${rupiah(Number(obj.total) || 0)}

Silakan transfer ke rekening berikut:
Bank BCA - 1281677387 a.n Budi Sinaga

Terima Kasih.`;
};





