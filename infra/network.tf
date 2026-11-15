# ShopOps network: one VPC across two Availability Zones.
#
#   public subnets  -> reachable from the internet (load balancer, later)
#   private subnets -> app and database, no direct internet access
#
# Everything here is free. There is deliberately NO NAT Gateway
# (about $33/month) and public subnets do NOT hand out public IPv4
# addresses automatically (each one costs money since 2024).

data "aws_availability_zones" "available" {
  state = "available"
}

locals {
  azs = slice(data.aws_availability_zones.available.names, 0, 2)
}

resource "aws_vpc" "main" {
  cidr_block           = var.vpc_cidr
  enable_dns_support   = true
  enable_dns_hostnames = true

  tags = { Name = "shopops-vpc" }
}

resource "aws_internet_gateway" "main" {
  vpc_id = aws_vpc.main.id
  tags   = { Name = "shopops-igw" }
}

# ---------- Subnets ----------
# cidrsubnet("10.0.0.0/16", 8, n) -> 10.0.n.0/24 (256 addresses each)

resource "aws_subnet" "public" {
  count = length(local.azs)

  vpc_id                  = aws_vpc.main.id
  availability_zone       = local.azs[count.index]
  cidr_block              = cidrsubnet(var.vpc_cidr, 8, count.index) # 10.0.0.0/24, 10.0.1.0/24
  map_public_ip_on_launch = false

  tags = { Name = "shopops-public-${local.azs[count.index]}", Tier = "public" }
}

resource "aws_subnet" "private" {
  count = length(local.azs)

  vpc_id            = aws_vpc.main.id
  availability_zone = local.azs[count.index]
  cidr_block        = cidrsubnet(var.vpc_cidr, 8, count.index + 10) # 10.0.10.0/24, 10.0.11.0/24

  tags = { Name = "shopops-private-${local.azs[count.index]}", Tier = "private" }
}

# ---------- Routing ----------

resource "aws_route_table" "public" {
  vpc_id = aws_vpc.main.id
  tags   = { Name = "shopops-public-rt" }
}

resource "aws_route" "public_internet" {
  route_table_id         = aws_route_table.public.id
  destination_cidr_block = "0.0.0.0/0"
  gateway_id             = aws_internet_gateway.main.id
}

resource "aws_route_table_association" "public" {
  count          = length(aws_subnet.public)
  subnet_id      = aws_subnet.public[count.index].id
  route_table_id = aws_route_table.public.id
}

# Private route table: only local VPC traffic, no route to the internet.
resource "aws_route_table" "private" {
  vpc_id = aws_vpc.main.id
  tags   = { Name = "shopops-private-rt" }
}

resource "aws_route_table_association" "private" {
  count          = length(aws_subnet.private)
  subnet_id      = aws_subnet.private[count.index].id
  route_table_id = aws_route_table.private.id
}

# ---------- Security ----------

# Every VPC comes with a "default" security group that allows all traffic
# between its members. Taking it over with no rules closes that hole.
resource "aws_default_security_group" "default" {
  vpc_id = aws_vpc.main.id
  tags   = { Name = "shopops-default-locked" }
}
