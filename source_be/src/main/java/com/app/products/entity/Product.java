package com.app.products.entity;

import com.app.common.entity.BaseEntity;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;
import java.math.BigDecimal;

@Entity
@Table(name = "products")
@Getter
@Setter
public class Product extends BaseEntity {

    private String name;
    
    private String sku;
    
    private BigDecimal price;
    
    private Integer stockQuantity;
}
