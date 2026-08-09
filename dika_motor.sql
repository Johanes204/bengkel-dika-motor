-- phpMyAdmin SQL Dump
-- version 5.2.0
-- https://www.phpmyadmin.net/
--
-- Host: 127.0.0.1
-- Generation Time: Aug 15, 2025 at 10:45 AM
-- Server version: 10.4.27-MariaDB
-- PHP Version: 8.2.0

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Database: `dika_motor`
--

-- --------------------------------------------------------

--
-- Table structure for table `admin`
--

CREATE TABLE `admin` (
  `id_admin` int(2) NOT NULL,
  `username_admin` varchar(50) NOT NULL,
  `email_admin` varchar(255) NOT NULL,
  `password_admin` varchar(10) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `customers`
--

CREATE TABLE `customers` (
  `id_customer` int(11) NOT NULL,
  `name_customer` varchar(100) NOT NULL,
  `phone_customer` varchar(20) NOT NULL,
  `address_customer` text DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `customers`
--

INSERT INTO `customers` (`id_customer`, `name_customer`, `phone_customer`, `address_customer`) VALUES
(18, 'JO JO', '081584998214', '-'),
(19, 'JO JO', '081584998214', '-'),
(20, 'JO JO1212', '081584998214', '-'),
(21, 'JO JO', '081584998214', '-'),
(22, 'JO JO', '081584998214', '-'),
(23, 'JO JO', '081584998214', '-'),
(24, 'JO JO', '081584998214', '-'),
(25, 'JO JO', '081584998214', '-'),
(26, 'testing 1', '2091209120912', 'ajlanadb'),
(27, 'testing 2', '122112121', 'jalan jalan'),
(28, 'testing 3', '12121212', 'jalan jalan ke 2'),
(29, 'JO JO', '081584998214', '-'),
(30, 'JO JO testing', '081584998214', '-'),
(31, 'testing 4', '21211212', 'jalan jaoan'),
(32, 'testing 7', '12128182128', 'jlan jalan cukurukuk'),
(33, 'johanes', '29812982198', 'depok'),
(34, 'Pace Diyanah', '12123108321', 'Sunda Kelapa'),
(35, 'JO JO', '081584998214', '-'),
(36, 'asksalasl', '8989899', 'ajasjaj'),
(37, 'testing 7', '839283298', 'kualanamu'),
(38, 'JO JO', '081584998214', '-'),
(39, 'JO JO', '081584998214', 'depokl'),
(40, 'JO JO', '081584998214', '-'),
(41, 'JO JO', '081584998214', '-'),
(42, 'cukimay', '12345678', 'jalan jalan'),
(43, 'Simon ganteng', '12345678', 'jalan surga'),
(44, 'JO JO', '081584998214', '-'),
(45, 'jojo', '081223465', 'jl.pengadegan'),
(46, 'yfugfuyu', '6767677676', 'ccuyfuyfu'),
(47, 'yfugfuyu', '6767677676', 'ccuyfuyfu'),
(48, 'yfugfuyu', '6767677676', 'ccuyfuyfu'),
(49, 'sempak', '198218928912', 'ajskajkadjka'),
(50, 'sempak', '198218928912', 'ajskajkadjka'),
(51, 'sempak', '198218928912', 'ajskajkadjka'),
(52, 'JO JO', '081584998214', '-'),
(53, 'JO JO', '081584998214', '-adoaisdjaisodj'),
(54, 'JO JO', '081584998214', '-'),
(55, 'JO JO', '081584998214', '-'),
(56, 'jojoo', '20210920', 'jalan jalan'),
(57, 'johans', '8129218', 'depok manggarai'),
(58, 'bagas dribel', '018298281082', 'jalan jalan'),
(59, 'jijmimjijmijmijmi', '0000000000', 'opopopopo'),
(60, 'JO JO', '081584998214', '-'),
(61, 'depok', '2109120919', 'depok mantap'),
(62, 'cihut', '09090990', 'ieieieiei'),
(63, '', '1121212', 'ahuyyy'),
(64, '', '6666666666666', 'pomoim'),
(65, '', '090909', 'bogor'),
(66, '', '08080808', 'jalan jalan'),
(67, 'ope ope', '0090909', 'jalan jalan'),
(68, 'jojoojo', '88989899889', 'jkowi'),
(69, 'hfhfhfhhf', '08080808', 'dsdssddss'),
(70, 'JO JO', '081584998214', '-'),
(71, 'JO JO', '081584998214', '-'),
(72, 'JO JO', '081584998214', '-'),
(73, 'tes selanjuntnya', '0192091092', 'test selanjutnya'),
(74, 'wqqwqeq', 'qweqeqewq', 'eqwwqeq'),
(75, 'depok', '101920129210', 'jalan depok margonda'),
(76, '12121221', '1211212', '12122112'),
(77, 'JO JO', '081584998214', '-'),
(78, 'testing terakhir banget', '112102912', 'kalo berhasi langsung lanjut bab 3'),
(79, 'testing versi terakhir bangetttt', 'ini berhasil langsun', 'ini berhasil langsung bab3(kalo gk ada error)'),
(80, 'Thomas pakpahan', '1281289219812', 'otw sidang Pi'),
(81, 'cukuruk', '29819298298', 'otw kelarr babikkkk');

-- --------------------------------------------------------

--
-- Table structure for table `products`
--

CREATE TABLE `products` (
  `id_product` int(11) NOT NULL,
  `name_product` varchar(50) NOT NULL,
  `img_product` varchar(255) NOT NULL,
  `detail_product` varchar(255) NOT NULL,
  `price_product` int(12) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `products`
--

INSERT INTO `products` (`id_product`, `name_product`, `img_product`, `detail_product`, `price_product`) VALUES
(1, 'MPX-2', 'oli-1.jpg', 'Diformulasikan oleh Honda R&D Japan dengan performa lubrikasi andal untuk melindungi sepeda motor Honda menjadi lebih irit namun bertenaga. Sangat hemat dengan penggantian yang lebih lama dan sekaligus mengurangi dampak pencemaran lingkungan. Memberikan d', 58000),
(2, 'MPX-1', 'oli-2.jpg', 'Diformulasikan oleh Honda R&D Japan dengan performa lubrikasi andal untuk melindungi sepeda motor Honda menjadi lebih irit namun bertenaga. Sangat hemat dengan penggantian yang lebih lama dan sekaligus mengurangi dampak pencemaran lingkungan. Memberikan d', 56000),
(3, 'SPX-1', 'oli-3.jpg', 'Untuk Bebek & Sport (Spesifikasi SAE:10W-30, API-SL, JASO:MA) Merupakan oli canggih dengan base oil FULLY SYNTHETIC yang diformulasikan oleh Honda R&D Japan. AHM Oil SPX-1 mampu menjaga kondisi mesin, terutama saat diperlukan performa yang lebih tinggi at', 68000);

-- --------------------------------------------------------

--
-- Table structure for table `transactions`
--

CREATE TABLE `transactions` (
  `id_transaction` int(100) NOT NULL,
  `id_customer` int(50) NOT NULL,
  `total_transactions` int(255) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `transactions`
--

INSERT INTO `transactions` (`id_transaction`, `id_customer`, `total_transactions`) VALUES
(1, 63, 114000),
(2, 64, 114000),
(3, 65, 56000),
(4, 66, 58000),
(5, 67, 114000),
(6, 68, 114000),
(7, 69, 124000),
(8, 70, 56000),
(9, 71, 58000),
(10, 76, 78000),
(11, 77, 68000),
(12, 78, 230000),
(13, 79, 134000),
(14, 80, 900272909),
(15, 81, 124000);

-- --------------------------------------------------------

--
-- Table structure for table `transactions_item`
--

CREATE TABLE `transactions_item` (
  `id_transaction_item` int(2) NOT NULL,
  `id_transaction` int(2) NOT NULL,
  `id_product` int(2) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `transactions_item`
--

INSERT INTO `transactions_item` (`id_transaction_item`, `id_transaction`, `id_product`) VALUES
(1, 1, 1),
(2, 1, 2),
(3, 2, 1),
(4, 2, 2),
(5, 3, 2),
(6, 4, 1),
(7, 5, 1),
(8, 5, 2),
(9, 6, 1),
(10, 6, 2),
(11, 7, 2),
(12, 7, 3),
(13, 8, 2),
(14, 9, 1),
(15, 10, 5),
(16, 10, 3),
(17, 11, 3),
(18, 12, 1),
(19, 12, 2),
(20, 13, 3),
(21, 13, 2),
(22, 13, 5),
(23, 14, 1),
(24, 14, 2),
(25, 14, 3),
(26, 14, 6),
(27, 15, 2),
(28, 15, 3);

--
-- Indexes for dumped tables
--

--
-- Indexes for table `admin`
--
ALTER TABLE `admin`
  ADD PRIMARY KEY (`id_admin`);

--
-- Indexes for table `customers`
--
ALTER TABLE `customers`
  ADD PRIMARY KEY (`id_customer`);

--
-- Indexes for table `products`
--
ALTER TABLE `products`
  ADD PRIMARY KEY (`id_product`);

--
-- Indexes for table `transactions`
--
ALTER TABLE `transactions`
  ADD PRIMARY KEY (`id_transaction`);

--
-- Indexes for table `transactions_item`
--
ALTER TABLE `transactions_item`
  ADD PRIMARY KEY (`id_transaction_item`);

--
-- AUTO_INCREMENT for dumped tables
--

--
-- AUTO_INCREMENT for table `admin`
--
ALTER TABLE `admin`
  MODIFY `id_admin` int(2) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `customers`
--
ALTER TABLE `customers`
  MODIFY `id_customer` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=82;

--
-- AUTO_INCREMENT for table `products`
--
ALTER TABLE `products`
  MODIFY `id_product` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=11;

--
-- AUTO_INCREMENT for table `transactions`
--
ALTER TABLE `transactions`
  MODIFY `id_transaction` int(100) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=16;

--
-- AUTO_INCREMENT for table `transactions_item`
--
ALTER TABLE `transactions_item`
  MODIFY `id_transaction_item` int(2) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=29;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
