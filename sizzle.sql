-- --------------------------------------------------------
-- Base de datos: sizzle
-- Objetivo: Tabla de usuarios con email único y contraseña hasheada (bcrypt)
-- Notas:
--  - Las contraseñas nunca se guardan en claro. Se guarda un hash bcrypt.
--  - Email y NombreUsuario no se pueden repetir.
--  - Juego/cliente se conecta a una API HTTPS; la API habla con esta BD.
-- --------------------------------------------------------

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
SET NAMES utf8mb4;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
SET TIME_ZONE = '+00:00';
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
SET SQL_MODE='NO_AUTO_VALUE_ON_ZERO';

-- Crear BD si no existe
CREATE DATABASE IF NOT EXISTS `sizzle`
  DEFAULT CHARACTER SET utf8mb4
  COLLATE utf8mb4_general_ci;

USE `sizzle`;

-- --------------------------------------------------------
-- Tabla: usuario
-- Campos:
--   Id             -> PK autoincremental
--   NombreUsuario  -> nombre mostrado / login alternativo (único)
--   Email          -> correo de la cuenta (único)
--   Contrasenia    -> hash bcrypt (VARCHAR(72) permite longitudes de bcrypt)
-- Reglas:
--   - UNIQUE en Email y NombreUsuario
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS `usuario` (
  `Id` INT(11) UNSIGNED NOT NULL AUTO_INCREMENT,
  `NombreUsuario` VARCHAR(32) NOT NULL,
  `Email` VARCHAR(254) NOT NULL,
  `Contrasenia` VARCHAR(72) NOT NULL,
  PRIMARY KEY (`Id`),
  UNIQUE KEY `UQ_usuario_NombreUsuario` (`NombreUsuario`),
  UNIQUE KEY `UQ_usuario_Email` (`Email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;


-- DELETE FROM `usuario`;
-- INSERT INTO `usuario` (`NombreUsuario`,`Email`,`Contrasenia`)
-- VALUES ('Lalo','lalo@gmail.com','$2b$10$SOME_EXAMPLE_BCRYPT_HASH..............');

-- Restaurar flags
/*!40014 SET FOREIGN_KEY_CHECKS=IFNULL(@OLD_FOREIGN_KEY_CHECKS, 1) */;
