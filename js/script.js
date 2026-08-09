// TOGGLE CLASS ACTIVE HAMBURGER MENU
const navbarNav = document.querySelector('.navbar-nav');

// HAMBURGER DI KLIK
document.querySelector('#hamburger-menu').onclick = (e) => {
    navbarNav.classList.toggle('active');
    e.preventDefault();
};

// TOGGLE CLASS ACTIVE SHOPPING CART
const shoppingCart = document.querySelector('.shopping-cart');

document.querySelector('#shopping-cart-button').onclick = (e) => {
    shoppingCart.classList.toggle('active');
    e.preventDefault();
};


// MENEKAN DI LUAR ELEMEN
const hm = document.querySelector('#hamburger-menu');
const sb = document.querySelector('#search-button');
const sc = document.querySelector('#shopping-cart-button');

document.addEventListener('click', function(e){
    if(!hm.contains(e.target)&& !navbarNav.contains(e.target)) {
        navbarNav.classList.remove('active');
    }
    if(!sc.contains(e.target)&& ! shoppingCart.contains(e.target)) {
        shoppingCart.classList.remove('active');
    }
});

// MODAL BOX
const itemDetailModal = document.querySelector('#item-detail-modal');
const itemDetailButtons = document.querySelectorAll('#item-detail-button');
const closeIcon = document.querySelector('.modal .close-icon');

itemDetailButtons.forEach((btn) => {
    console.log(btn);
    // Tambahkan event listener untuk setiap tombol detail item
    // Menggunakan event delegation untuk menangani klik pada tombol detail
    btn.addEventListener('click', (e) => {
        e.preventDefault();
        itemDetailModal.classList.add('active');
    });
});



// TOMBOL CLOSE
closeIcon.addEventListener('click', (e) => {
    e.preventDefault();
    itemDetailModal.classList.remove('active');
});

// DI LUAR AREA
window.onclick = (e) => {
    if (e.target === itemDetailModal) {
        itemDetailModal.style.display = 'none';
    };
};


// LOGIN FORM TOGGLE
function showForm(formId) {
    document.querySelectorAll('.form-box').forEach(form => form.classList.remove("active"));
    document.getElementById(formId).classList.add("active");
}

// RUNNING TEXT
var style = document.createElement('style');
var position = 'right';

style.innerHTML = `
    @keyframes my-animation {
        0%{${position}: -${document.querySelector('.text').offsetWidth + 10}px;}
        100%{${position}: 100%;}
}`;
document.head.appendChild(style);

// JAM
let hrs = document.querySelector('#hrs');
let min = document.querySelector('#min');
let sec = document.querySelector('#sec');

setInterval(() => {
    let currentTime = new Date();
    
    hrs.innerHTML = currentTime.getHours().toString().padStart(2, '0');
    min.innerHTML = currentTime.getMinutes().toString().padStart(2, '0');
    sec.innerHTML = currentTime.getSeconds().toString().padStart(2, '0');
},1000);


