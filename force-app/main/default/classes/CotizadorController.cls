public class CotizadorController {
  @AuraEnabled(cacheable=true)
  public static List<Tela__c> getTelas(String tipoTela) {
    if (!String.isEmpty(tipoTela)) {
      return [
        SELECT Id, Name, Tipo__c, Precio__c, PrecioIVA__c, PrecioSinFactura__c
        FROM Tela__c
        WHERE Tipo__c = :tipoTela
      ];
    }
    return new List<Tela__c>();
  }

  @AuraEnabled(cacheable=true)
  public static List<Mecanismo__c> getMecanismos() {
    return [
      SELECT Id, Name, Tipo__c, Precio__c, PrecioIVA__c, PrecioSinFactura__c
      FROM Mecanismo__c
    ];
  }

  @AuraEnabled
  public static Cotizacion__c saveCotization(List<Ventana__c> ventanas) {
    Cotizacion__c cotizacion = new Cotizacion__c(Name = 'Referencia');
    insert cotizacion;
    for (Ventana__c v : ventanas) {
      v.Cotizacion__c = cotizacion.Id;
    }
    insert ventanas;
    return cotizacion;
  }
}
