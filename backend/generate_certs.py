import datetime
import ipaddress
from cryptography import x509
from cryptography.x509.oid import NameOID
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import rsa

# --- CONFIGURATION ---
# Replace this with your actual machine IP
MY_IP = "192.168.0.105" 

# 1. Generate Private Key
private_key = rsa.generate_private_key(
    public_exponent=65537,
    key_size=2048,
)

# 2. Setup Certificate Details
subject = issuer = x509.Name([
    x509.NameAttribute(NameOID.COUNTRY_NAME, u"IN"),
    x509.NameAttribute(NameOID.ORGANIZATION_NAME, u"CallSphere"),
    x509.NameAttribute(NameOID.COMMON_NAME, MY_IP),
])

# 3. Build the Certificate
cert = (
    x509.CertificateBuilder()
    .subject_name(subject)
    .issuer_name(issuer)
    .public_key(private_key.public_key())
    .serial_number(x509.random_serial_number())
    .not_valid_before(datetime.datetime.utcnow())
    .not_valid_after(datetime.datetime.utcnow() + datetime.timedelta(days=3650))
    .add_extension(
        x509.SubjectAlternativeName([x509.IPAddress(ipaddress.ip_address(MY_IP))]),
        critical=False,
    )
    .sign(private_key, hashes.SHA256())
)

# 4. Write Private Key File (key.pem)
with open("key.pem", "wb") as f:
    f.write(private_key.private_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PrivateFormat.TraditionalOpenSSL,
        encryption_algorithm=serialization.NoEncryption(),
    ))

# 5. Write Certificate File (cert.pem)
with open("cert.pem", "wb") as f:
    f.write(cert.public_bytes(serialization.Encoding.PEM))

print(f"DONE! 'cert.pem' and 'key.pem' generated for IP: {MY_IP}")